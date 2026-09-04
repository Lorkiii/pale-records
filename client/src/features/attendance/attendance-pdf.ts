// Generates monthly reports and selected-date template bundles in the browser.
import {
  appendAttendanceTable,
  appendAttendanceTemplateTable,
  chunkAttendanceDates,
  drawAttendanceReportFooters,
  drawAttendanceTemplateFooters,
} from './attendance-pdf-layout';
import type { MonthlyAttendanceReport } from './attendance-report';
import type { PrintableAttendanceTemplate } from './attendance-template';

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

// Builds one ordered PDF while preserving each date template's independent page identity.
export async function createPrintableAttendanceTemplatesPdf(
  templates: readonly PrintableAttendanceTemplate[],
) {
  if (templates.length === 0) {
    throw new Error('Select at least one attendance date before printing.');
  }

  const [{ jsPDF: JsPdf }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const firstTemplate = templates[0];
  const lastTemplate = templates[templates.length - 1];
  const isSingleTemplate = templates.length === 1;

  document.setProperties({
    title: isSingleTemplate
      ? `${firstTemplate.subject} Attendance Template - ${firstTemplate.attendanceDateIso}`
      : `${firstTemplate.subject} Attendance Templates - ${firstTemplate.attendanceDateIso} to ${lastTemplate.attendanceDateIso}`,
    subject: isSingleTemplate
      ? `Printable Attendance Template ${firstTemplate.templateReference}`
      : `${templates.length} printable Attendance date templates`,
    author: firstTemplate.createdBy,
    creator: 'PALE Records',
  });

  const templatePageRanges = templates.map((template, templateIndex) => {
    if (templateIndex > 0) {
      document.addPage();
    }

    const firstPageNumber = document.getNumberOfPages();
    appendAttendanceTemplateTable(document, template, autoTable);
    return {
      template,
      firstPageNumber,
      lastPageNumber: document.getNumberOfPages(),
    };
  });

  templatePageRanges.forEach(({ template, firstPageNumber, lastPageNumber }) => {
    drawAttendanceTemplateFooters(document, template, firstPageNumber, lastPageNumber);
  });
  return document;
}

// Downloads one selected-date template bundle for printing or offline storage.
export async function downloadPrintableAttendanceTemplatesPdf(
  templates: readonly PrintableAttendanceTemplate[],
  filename: string,
) {
  const document = await createPrintableAttendanceTemplatesPdf(templates);
  document.save(filename);
}

// Opens one browser PDF preview so printing does not require navigating away from Attendance.
export async function openPrintableAttendanceTemplatesPdf(
  templates: readonly PrintableAttendanceTemplate[],
  previewWindow: Window | null = window.open('', '_blank'),
) {
  if (!previewWindow) {
    throw new Error('The browser blocked the printable PDF window. Allow pop-ups or download the PDF instead.');
  }

  previewWindow.opener = null;
  previewWindow.document.title = 'Preparing attendance templates';
  previewWindow.document.body.textContent = 'Preparing printable attendance templates...';

  try {
    const document = await createPrintableAttendanceTemplatesPdf(templates);
    const objectUrl = URL.createObjectURL(document.output('blob'));
    previewWindow.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
