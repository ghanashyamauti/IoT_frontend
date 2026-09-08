/**
 * RFID Web Serial Service — React-compatible
 * Ported from the original rfidSerialService.js
 * Uses the Web Serial API (Chrome/Edge only)
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
    this.debounceMs = 1500;

    this.uidListeners = new Set();
    this.statusListeners = new Set();

    if (this.isSupported()) {
      navigator.serial.addEventListener('disconnect', (event) => {
        if (this.port && event.target === this.port) {
          this.handleDisconnect('USB Device Disconnected');
        }
      });
    }
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  onUid(callback) {
    this.uidListeners.add(callback);
    return () => this.uidListeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus(connected, message = '') {
    this.isConnected = connected;
    this.statusListeners.forEach(fn => { try { fn(connected, message); } catch {} });
  }

  notifyUid(uid) {
    this.uidListeners.forEach(fn => { try { fn(uid); } catch {} });
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Serial not supported. Use Chrome or Edge.');
    }
    if (this.isConnected && this.port) return true;

    try {
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
      if (err.name === 'NotFoundError') return false;
      if (err.message?.includes('Failed to open') || err.message?.includes('busy')) {
        throw new Error('Port busy! Close Serial Monitor in Arduino IDE first.');
      }
      throw err;
    }
  }

  async startReadLoop() {
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) this.parseLine(trimmed);
          }
        }
      }
    } catch (error) {
      if (this.keepReading) {
        this.handleDisconnect('Serial read error');
      }
    } finally {
      try { this.reader.releaseLock(); } catch {}
    }
  }

  parseLine(line) {
    const uidRegex = /(?:UID|RFID_UID|Card\s*UID)\s*[:=]\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){3,9})/i;
    const match = line.match(uidRegex);
    let extractedUid = null;

    if (match?.[1]) {
      extractedUid = match[1];
    } else {
      const rawMatch = line.match(/^([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){3,9})$/);
      if (rawMatch?.[1]) extractedUid = rawMatch[1];
    }

    if (extractedUid) {
      const normalizedUid = extractedUid.trim().toUpperCase();
      const now = Date.now();
      if (this.lastUid === normalizedUid && (now - this.lastUidTime) < this.debounceMs) return;
      this.lastUid = normalizedUid;
      this.lastUidTime = now;
      this.notifyUid(normalizedUid);
    }
  }

  async disconnect() {
    this.keepReading = false;
    try { await this.reader?.cancel(); } catch {}
    try { this.reader?.releaseLock(); } catch {}
    this.reader = null;
    try { await this.readableStreamClosed?.catch(() => {}); } catch {}
    this.readableStreamClosed = null;
    try { await this.port?.close(); } catch {}
    this.port = null;
    this.notifyStatus(false, 'Disconnected');
  }

  handleDisconnect(reason = 'Disconnected') {
    this.keepReading = false;
    this.port = null;
    this.reader = null;
    this.notifyStatus(false, reason);
  }
}

// Singleton
export const rfidSerial = new RfidSerialService();
