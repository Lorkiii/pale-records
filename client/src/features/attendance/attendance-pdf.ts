// Generates and downloads the compact monthly Attendance PDF in the browser.
import {
  appendAttendanceTable,
  chunkAttendanceDates,
  drawAttendanceReportFooters,
} from './attendance-pdf-layout';
import type { MonthlyAttendanceReport } from './attendance-report';

// Builds the final PDF document so browser download and visual QA share one layout path.
export async function createMonthlyAttendancePdf(report: MonthlyAttendanceReport) {
  const [{ jsPDF: JsPdf }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateChunks = chunkAttendanceDates(report.dates);

  document.setProperties({
    title: `${report.subject} Attendance - ${report.monthYear}`,
    subject: `Monthly Attendance for ${report.monthYear}`,
    author: report.createdBy,
    creator: 'PALE Records',
  });

  dateChunks.forEach((dateChunk, chunkIndex) => {
    if (chunkIndex > 0) {
      document.addPage();
    }

    appendAttendanceTable(document, report, dateChunk, autoTable);
  });

  drawAttendanceReportFooters(document);
  return document;
}

// Downloads the generated document only after its complete monthly layout is built.
export async function downloadMonthlyAttendancePdf(report: MonthlyAttendanceReport) {
  const document = await createMonthlyAttendancePdf(report);
  document.save(report.filename);
}
