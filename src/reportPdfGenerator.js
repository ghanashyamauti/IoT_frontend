import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BASE_PATH } from './config';

/**
 * Loads the company logo as a base64 Data URL for embedding into the PDF.
 */
async function loadLogoBase64() {
  try {
    const url = `${BASE_PATH}shakham_logo.png`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates and downloads a beautifully structured corporate attendance PDF.
 *
 * @param {Object} summary - Attendance summary data for the month
 * @param {string} monthStr - Month in YYYY-MM format
 */
export async function downloadAttendancePdf(summary, monthStr) {
  if (!summary || !summary.employees) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(13, 148, 136); // Shakham Teal
  doc.rect(0, 0, pageWidth, 4.5, 'F');

  // 2. Load and add Company Logo
  const logoData = await loadLogoBase64();
  let textStartX = margin;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, 10, 16, 16);
      textStartX = margin + 20;
    } catch {
      textStartX = margin;
    }
  }

  // 3. Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('SHAKHAM ATTENDANCE SYSTEM', textStartX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Official Monthly Attendance & Performance Report', textStartX, 22);

  // Parse Month Title (e.g. October 2026)
  let monthLabel = monthStr || summary.month || '';
  try {
    const [y, m] = monthLabel.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    monthLabel = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch {}

  // Header Right Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Reporting Period: ${monthLabel}`, pageWidth - margin, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dates: ${summary.month_start} to ${summary.month_end}`, pageWidth - margin, 20, { align: 'right' });
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pageWidth - margin,
    25,
    { align: 'right' }
  );

  // Separator Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, 29, pageWidth - margin, 29);

  // 4. Executive KPI Overview Boxes
  const totalEmployees = summary.employees.length;
  const workingDays = summary.working_days || 0;
  const totalPresent = summary.employees.reduce((acc, emp) => acc + (emp.days_present || 0), 0);
  const totalScans = summary.employees.reduce((acc, emp) => acc + (emp.total_scans || 0), 0);
  const avgAttendance = totalEmployees > 0 && workingDays > 0
    ? Math.round((totalPresent / (totalEmployees * workingDays)) * 100)
    : 0;

  const kpis = [
    { label: 'Working Days', value: `${workingDays} Days`, sub: 'Excluding Sundays' },
    { label: 'Registered Staff', value: `${totalEmployees}`, sub: 'Active in system' },
    { label: 'Avg. Attendance', value: `${avgAttendance}%`, sub: 'Across all employees' },
    { label: 'Total Scans', value: `${totalScans}`, sub: 'IN & OUT events' },
  ];

  const kpiY = 33;
  const kpiBoxWidth = (contentWidth - 3 * 4) / 4;
  const kpiHeight = 16;

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiBoxWidth + 4);

    // Box Background & Border
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(kpiX, kpiY, kpiBoxWidth, kpiHeight, 1.5, 1.5, 'FD');

    // KPI Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136); // Teal Accent
    doc.text(kpi.value, kpiX + kpiBoxWidth / 2, kpiY + 6.5, { align: 'center' });

    // KPI Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(kpi.label, kpiX + kpiBoxWidth / 2, kpiY + 11, { align: 'center' });

    // KPI Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, kpiX + kpiBoxWidth / 2, kpiY + 14.2, { align: 'center' });
  });

  // 5. Attendance Summary Table
  const tableData = summary.employees.map((emp, index) => {
    const pct = workingDays > 0 ? Math.round((emp.days_present / workingDays) * 100) : 0;
    return [
      (index + 1).toString(),
      emp.employee_name,
      emp.employee_code || '-',
      emp.department || 'General',
      `${emp.days_present} / ${workingDays}`,
      emp.days_absent.toString(),
      `${pct}%`,
      emp.total_scans.toString(),
    ];
  });

  // Footer summary totals row
  tableData.push([
    '',
    'Average / Total',
    `${totalEmployees} Staff`,
    '-',
    `${totalPresent} total`,
    '-',
    `${avgAttendance}%`,
    totalScans.toString(),
  ]);

  autoTable(doc, {
    startY: 53,
    head: [['#', 'Employee Name', 'Code', 'Department', 'Days Present', 'Days Absent', 'Rate (%)', 'Scans']],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 22 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 18 },
    },
    didParseCell: (data) => {
      // Highlight the last summary totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
      // Color-code attendance rate column
      if (data.column.index === 6 && data.section === 'body' && data.row.index !== tableData.length - 1) {
        const val = parseInt(data.cell.raw, 10);
        if (!isNaN(val)) {
          if (val >= 80) {
            data.cell.styles.textColor = [22, 163, 74]; // Green
          } else if (val >= 50) {
            data.cell.styles.textColor = [217, 119, 6]; // Amber
          } else {
            data.cell.styles.textColor = [220, 38, 38]; // Red
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Add Footer on each page
      const pageNum = doc.getNumberOfPages();
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Shakham IoT Attendance Monitoring System · Official Record · Confidential',
        margin,
        pageHeight - 9
      );

      doc.text(
        `Page ${data.pageNumber} of ${pageNum}`,
        pageWidth - margin,
        pageHeight - 9,
        { align: 'right' }
      );
    },
  });

  // Save and prompt download
  const safeMonth = (monthStr || summary.month || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Shakham_Attendance_Report_${safeMonth}.pdf`);
}
