/**
 * RFID Web Serial Service
 * -------------------------------------------------------------
 * Provides browser <-> ESP32 USB Serial communication using the
 * native Web Serial API (navigator.serial).
 *
 * Handles:
 *  - Port selection & connection lifecycle (baud 115200)
 *  - Streaming chunk decoder with newline line buffering
 *  - Regex extraction & normalization of RFID UIDs (e.g. CD:FA:02:07)
 *  - Duplicate scan debouncing
 *  - Disconnect / reconnect event handling
 *  - Clean stream reader cancellation and port closing
 */

class RfidSerialService {
  constructor() {
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.keepReading = false;
    this.isConnected = false;
    this.lastUid = null;
    this.lastUidTime = 0;
    this.debounceMs = 1500; // Ignore exact same physical card read within 1.5s on serial buffer

    this.uidListeners = new Set();
    this.statusListeners = new Set();
    this.rawLogListeners = new Set();

    // Auto-listen for OS-level USB disconnects if supported
    if (this.isSupported()) {
      navigator.serial.addEventListener('disconnect', (event) => {
        if (this.port && event.target === this.port) {
          console.warn('[WebSerial] ESP32 USB device physically disconnected.');
          this.handleDisconnect('USB Device Disconnected');
        }
      });
    }
  }

  /**
   * Check if Web Serial API is supported in current browser
   */
  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Register UID scan callback
   */
  onUid(callback) {
    this.uidListeners.add(callback);
    return () => this.uidListeners.delete(callback);
  }

  /**
   * Register connection status callback: (isConnected: boolean, statusText: string)
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Register raw serial log listener (useful for debugging)
   */
  onRawLog(callback) {
    this.rawLogListeners.add(callback);
    return () => this.rawLogListeners.delete(callback);
  }

  notifyStatus(connected, message = '') {
    this.isConnected = connected;
    this.statusListeners.forEach((fn) => {
      try {
        fn(connected, message);
      } catch (err) {
        console.error('[WebSerial] Status listener error:', err);
      }
    });
  }

  notifyUid(uid) {
    this.uidListeners.forEach((fn) => {
      try {
        fn(uid);
      } catch (err) {
        console.error('[WebSerial] UID listener error:', err);
      }
    });
  }

  notifyRawLog(line) {
    this.rawLogListeners.forEach((fn) => {
      try {
        fn(line);
      } catch (err) {
        console.error('[WebSerial] Raw log listener error:', err);
      }
    });
  }

  /**
   * Request port permission and connect at 115200 baud
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    if (this.isConnected && this.port) {
      return true;
    }

    try {
      // Request user to pick the ESP32 COM port
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.keepReading = true;
      this.notifyStatus(true, 'USB RFID Reader Connected');
      this.startReadLoop();
      return true;
    } catch (err) {
      this.port = null;
      this.keepReading = false;
      this.notifyStatus(false, 'Disconnected');
      if (err.name === 'NotFoundError') {
        // User cancelled the prompt
        return false;
      }
      if (err.message && (err.message.includes('Failed to open') || err.message.includes('busy') || err.name === 'NetworkError')) {
        throw new Error('Port is busy! Please CLOSE the Serial Monitor in Arduino IDE and click Connect again.');
      }
      throw err;
    }
  }

  /**
   * Continuous read loop with chunk buffering & line extraction
   */
  async startReadLoop() {
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          // Keep the incomplete last fragment in the buffer
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.notifyRawLog(trimmed);
              this.parseLine(trimmed);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[WebSerial] Read error or port closed:', error);
      if (this.keepReading) {
        this.handleDisconnect('Serial read error: ' + (error.message || 'Port lost'));
      }
    } finally {
      try {
        this.reader.releaseLock();
      } catch (_) {}
    }
  }

  /**
   * Parse serial line to extract and normalize RFID UID
   * Matches lines like:
   *   "UID              : CD:FA:02:07"
   *   "UID: CD:FA:02:07"
   *   "RFID_UID:CD:FA:02:07"
   *   "Card Detected! UID: CD:FA:02:07"
   */
  parseLine(line) {
    // 1. Check for standard UID : XX:XX:XX:XX pattern
    const uidRegex = /(?:UID|RFID_UID|Card\s*UID)\s*[:=]\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){3,9})/i;
    const match = line.match(uidRegex);

    let extractedUid = null;
    if (match && match[1]) {
      extractedUid = match[1];
    } else {
      // 2. Fallback: check if line is purely a hex colon sequence (e.g. "CD:FA:02:07")
      const rawHexRegex = /^([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){3,9})$/;
      const rawMatch = line.match(rawHexRegex);
      if (rawMatch && rawMatch[1]) {
        extractedUid = rawMatch[1];
      }
    }

    if (extractedUid) {
      const normalizedUid = extractedUid.trim().toUpperCase();
      const now = Date.now();

      // Debounce exact same card read within debounceMs window
      if (this.lastUid === normalizedUid && (now - this.lastUidTime) < this.debounceMs) {
        return;
      }

      this.lastUid = normalizedUid;
      this.lastUidTime = now;

      console.log('[WebSerial] Extracted UID:', normalizedUid);
      this.notifyUid(normalizedUid);
    }
  }

  /**
   * Graceful disconnect
   */
  async disconnect() {
    this.keepReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (_) {}
      try {
        this.reader.releaseLock();
      } catch (_) {}
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      try {
        await this.readableStreamClosed.catch(() => {});
      } catch (_) {}
      this.readableStreamClosed = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {
        console.warn('[WebSerial] Error closing port:', err);
      }
      this.port = null;
    }

    this.notifyStatus(false, 'Disconnected');
  }

  handleDisconnect(reason = 'Disconnected') {
    this.keepReading = false;
    this.port = null;
    this.reader = null;
    this.notifyStatus(false, reason);
  }
}

// Attach to window object for global availability
window.rfidSerial = new RfidSerialService();
