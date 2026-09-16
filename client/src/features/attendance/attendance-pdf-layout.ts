// Owns the monthly report and printable Attendance template PDF layouts.
import type { jsPDF } from 'jspdf';
import type { AttendanceReportDate, MonthlyAttendanceReport } from './attendance-report';
import type {
  PrintableAttendanceMatrix,
  PrintableAttendanceMatrixDate,
  PrintableAttendanceMatrixStudent,
  PrintableAttendanceTemplate,
} from './attendance-template';
import {
  ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_PAGE_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM,
  ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM,
  ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM,
  ATTENDANCE_TEMPLATE_REMARKS_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_TABLE_TOP_MM,
  getAttendanceTemplatePageRowRange,
} from './attendance-template-layout';
import {
  ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM,
  encodeAttendanceTemplatePageIdentity,
} from './attendance-template-identity';

type AutoTableRenderer = typeof import('jspdf-autotable').autoTable;

const PAGE_MARGIN = ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM;
const REPORT_HEADER_BOTTOM = 43;
const DATE_COLUMNS_PER_PAGE = 10;
const STUDENT_COLUMN_WIDTH = 48;
const DATE_COLUMNS_TOTAL_WIDTH = 150;
const REMARKS_COLUMN_WIDTH = 79;
const PRINTABLE_MATRIX_TABLE_TOP = 47;
const PRINTABLE_MATRIX_STUDENT_COLUMN_WIDTH = 70;
const PRINTABLE_MATRIX_DATE_COLUMNS_TOTAL_WIDTH = 132;
const PRINTABLE_MATRIX_REMARKS_COLUMN_WIDTH = 75;
const PRINTABLE_MATRIX_MIN_ROW_HEIGHT = 7.25;
const PRINTABLE_MATRIX_PAGE_SAFETY_GAP = 4;
const PAPER_MUTED: [number, number, number] = [234, 234, 228];
const PAPER_LIGHT: [number, number, number] = [252, 252, 250];
const PAPER_ALTERNATE: [number, number, number] = [244, 244, 240];
const PAPER_BORDER: [number, number, number] = [216, 216, 207];
const INK: [number, number, number] = [10, 10, 10];

// Keeps wide monthly matrices legible by repeating identity and Remarks columns.
export function chunkAttendanceDates(dates: AttendanceReportDate[]) {
  const chunks: AttendanceReportDate[][] = [];

  for (let index = 0; index < dates.length; index += DATE_COLUMNS_PER_PAGE) {
    chunks.push(dates.slice(index, index + DATE_COLUMNS_PER_PAGE));
  }

  return chunks.length > 0 ? chunks : [[]];
}

// Splits a wide printable matrix into readable horizontal continuations.
export function chunkPrintableAttendanceMatrixDates(
  dates: readonly PrintableAttendanceMatrixDate[],
) {
  const chunks: PrintableAttendanceMatrixDate[][] = [];

  for (let index = 0; index < dates.length; index += DATE_COLUMNS_PER_PAGE) {
    chunks.push(dates.slice(index, index + DATE_COLUMNS_PER_PAGE));
  }

  return chunks.length > 0 ? chunks : [[]];
}

function getPrintableAttendanceMatrixRowsPerPage(studentCount: number) {
  const usableBodyHeight = ATTENDANCE_TEMPLATE_PAGE_HEIGHT_MM - PRINTABLE_MATRIX_TABLE_TOP -
    ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM - 18 - PRINTABLE_MATRIX_PAGE_SAFETY_GAP;
  const maximumRowsPerPage = Math.max(
    1,
    Math.floor(usableBodyHeight / PRINTABLE_MATRIX_MIN_ROW_HEIGHT),
  );
  const pageCount = Math.max(1, Math.ceil(studentCount / maximumRowsPerPage));
  return Math.max(1, Math.ceil(studentCount / pageCount));
}

// Balances roster rows before rendering so continuation pages keep their full header area.
export function chunkPrintableAttendanceMatrixStudents(
  students: readonly PrintableAttendanceMatrixStudent[],
) {
  const rowsPerPage = getPrintableAttendanceMatrixRowsPerPage(students.length);
  const chunks: PrintableAttendanceMatrixStudent[][] = [];

  for (let index = 0; index < students.length; index += rowsPerPage) {
    chunks.push(students.slice(index, index + rowsPerPage));
  }

  return chunks;
}

// Fits one metadata value on a fixed report line without colliding with adjacent fields.
function fitPdfText(document: jsPDF, value: string, maximumWidth: number) {
  if (document.getTextWidth(value) <= maximumWidth) {
    return value;
  }

  let fittedValue = value;
  while (
    fittedValue.length > 1 &&
    document.getTextWidth(`${fittedValue}...`) > maximumWidth
  ) {
    fittedValue = fittedValue.slice(0, -1);
  }

  return `${fittedValue}...`;
}

// Draws one label/value pair using truthful placeholders for nullable class metadata.
function drawMetadataLine(
  document: jsPDF,
  label: string,
  value: string | null,
  x: number,
  y: number,
  maximumWidth: number,
) {
  const labelText = `${label}: `;
  document.setFont('helvetica', 'bold');
  document.text(labelText, x, y);
  const labelWidth = document.getTextWidth(labelText);
  document.setFont('helvetica', 'normal');
  document.text(
    fitPdfText(document, value?.trim() || '-', maximumWidth - labelWidth),
    x + labelWidth,
    y,
  );
}

// Adds stable high-contrast page anchors for later scan alignment.
function drawTemplateRegistrationMarks(document: jsPDF) {
  document.setFillColor(...INK);
  ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM.forEach((mark) => {
    document.rect(
      mark.x - (ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM / 2),
      mark.y - (ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM / 2),
      ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM,
      ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM,
      'F',
    );
  });
}

// Repeats the report identity and export warnings above every continued table page.
function drawReportHeader(document: jsPDF, report: MonthlyAttendanceReport) {
  const pageWidth = document.internal.pageSize.getWidth();

  document.setTextColor(...INK);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text(report.monthYear, pageWidth / 2, 10, { align: 'center' });
  document.setDrawColor(...INK);
  document.setLineWidth(0.35);
  document.line(PAGE_MARGIN, 14, pageWidth - PAGE_MARGIN, 14);

  document.setFontSize(7.5);
  drawMetadataLine(document, 'Subject', report.subject, PAGE_MARGIN, 20, 165);
  drawMetadataLine(document, 'Subject Code', report.subjectCode, PAGE_MARGIN, 25, 165);
  drawMetadataLine(
    document,
    'School Year and Sem',
    report.schoolYearAndSemester,
    PAGE_MARGIN,
    30,
    165,
  );
  drawMetadataLine(document, 'Created By', report.createdBy, 190, 20, 97);
  drawMetadataLine(document, 'Date Created', report.dateCreated, 190, 25, 97);

  const warnings: string[] = [];
  if (report.excludesUnsavedEdits) {
    warnings.push('Unsaved edits were not included; the last saved values were exported.');
  }

  if (warnings.length > 0) {
    document.setFont('helvetica', 'bold');
    document.setFontSize(6.5);
    document.text(
      document.splitTextToSize(`Warning: ${warnings.join(' ')}`, pageWidth - 20),
      PAGE_MARGIN,
      36,
    );
  }
}

// Repeats the selected-date identity and handwriting instructions on every template page.
function drawAttendanceTemplateHeader(
  document: jsPDF,
  template: PrintableAttendanceTemplate,
) {
  const pageWidth = document.internal.pageSize.getWidth();

  drawTemplateRegistrationMarks(document);
  document.setTextColor(...INK);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('ATTENDANCE TEMPLATE', pageWidth / 2, 10, { align: 'center' });
  document.setDrawColor(...INK);
  document.setLineWidth(0.35);
  document.line(PAGE_MARGIN, 14, pageWidth - PAGE_MARGIN, 14);

  document.setFontSize(7.5);
  drawMetadataLine(document, 'Subject', template.subject, PAGE_MARGIN, 20, 165);
  drawMetadataLine(document, 'Subject Code', template.subjectCode, PAGE_MARGIN, 25, 165);
  drawMetadataLine(document, 'Section', template.section, PAGE_MARGIN, 30, 165);
  drawMetadataLine(
    document,
    'School Year and Sem',
    template.schoolYearAndSemester,
    PAGE_MARGIN,
    35,
    165,
  );
  drawMetadataLine(document, 'Attendance Date', template.attendanceDate, 190, 20, 97);
  drawMetadataLine(document, 'Prepared By', template.createdBy, 190, 25, 97);
  drawMetadataLine(document, 'Date Created', template.dateCreated, 190, 30, 97);
  drawMetadataLine(document, 'Template Ref', template.templateReference, 190, 35, 97);

  document.setFont('helvetica', 'bold');
  document.setFontSize(6.5);
  document.text(
    'Write one uppercase P, A, L, or E in the date column. Leave blank if unmarked. Remarks are required for E.',
    PAGE_MARGIN,
    42,
  );
}

// Repeats the combined matrix identity and handwriting guidance on continuation pages.
function drawPrintableAttendanceMatrixHeader(
  document: jsPDF,
  matrix: PrintableAttendanceMatrix,
) {
  const pageWidth = document.internal.pageSize.getWidth();
  const firstDate = matrix.dates[0]?.attendanceDateIso ?? '-';
  const lastDate = matrix.dates[matrix.dates.length - 1]?.attendanceDateIso ?? '-';

  document.setTextColor(...INK);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('ATTENDANCE TEMPLATE', pageWidth / 2, 10, { align: 'center' });
  document.setDrawColor(...INK);
  document.setLineWidth(0.35);
  document.line(PAGE_MARGIN, 14, pageWidth - PAGE_MARGIN, 14);

  document.setFontSize(7.5);
  drawMetadataLine(document, 'Subject', matrix.subject, PAGE_MARGIN, 20, 165);
  drawMetadataLine(document, 'Subject Code', matrix.subjectCode, PAGE_MARGIN, 25, 165);
  drawMetadataLine(document, 'Section', matrix.section, PAGE_MARGIN, 30, 165);
  drawMetadataLine(
    document,
    'School Year and Sem',
    matrix.schoolYearAndSemester,
    PAGE_MARGIN,
    35,
    165,
  );
  drawMetadataLine(document, 'Date Range', `${firstDate} to ${lastDate}`, 190, 20, 97);
  drawMetadataLine(document, 'Prepared By', matrix.createdBy, 190, 25, 97);
  drawMetadataLine(document, 'Date Created', matrix.dateCreated, 190, 30, 97);
  document.setFont('helvetica', 'bold');
  document.setFontSize(6.5);
  document.text(
    'Write one P, A, L, or E in each applicable date cell. Leave unmarked cells blank. Prefix each remark with its date.',
    PAGE_MARGIN,
    42,
  );
}

// Appends one horizontal date chunk and lets AutoTable continue it vertically as needed.
export function appendAttendanceTable(
  document: jsPDF,
  report: MonthlyAttendanceReport,
  dateChunk: AttendanceReportDate[],
  renderTable: AutoTableRenderer,
) {
  const headers = ['Student', ...dateChunk.map((date) => date.label), 'Remarks'];
  const body = report.students.map((student) => {
    const remarks = dateChunk
      .map((date) => {
        const remark = student.remarkByDateId[date.id];
        return remark ? `${date.label}: ${remark}` : '';
      })
      .filter(Boolean)
      .join('\n');

    return [
      student.name,
      ...dateChunk.map((date) => student.statusByDateId[date.id] ?? '-'),
      remarks || '-',
    ];
  });
  const dateColumnWidth = dateChunk.length > 0
    ? DATE_COLUMNS_TOTAL_WIDTH / dateChunk.length
    : DATE_COLUMNS_TOTAL_WIDTH / DATE_COLUMNS_PER_PAGE;
  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' }> = {
    0: { cellWidth: STUDENT_COLUMN_WIDTH, halign: 'left' },
    [headers.length - 1]: { cellWidth: REMARKS_COLUMN_WIDTH, halign: 'left' },
  };

  dateChunk.forEach((_, index) => {
    columnStyles[index + 1] = { cellWidth: dateColumnWidth, halign: 'center' };
  });

  renderTable(document, {
    startY: REPORT_HEADER_BOTTOM,
    head: [headers],
    body,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    margin: {
      top: REPORT_HEADER_BOTTOM,
      right: PAGE_MARGIN,
      bottom: 14,
      left: PAGE_MARGIN,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: INK,
      fillColor: PAPER_LIGHT,
      lineColor: PAPER_BORDER,
      lineWidth: 0.2,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PAPER_MUTED,
      textColor: INK,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: INK,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: PAPER_ALTERNATE },
    columnStyles,
    willDrawPage: () => drawReportHeader(document, report),
  });
}

// Draws a roomy blank selected-date grid that follows the monthly report structure.
export function appendAttendanceTemplateTable(
  document: jsPDF,
  template: PrintableAttendanceTemplate,
  renderTable: AutoTableRenderer,
) {
  renderTable(document, {
    startY: ATTENDANCE_TEMPLATE_TABLE_TOP_MM,
    head: [['Student', template.attendanceDateLabel, 'Remarks']],
    body: template.students.map((student) => [
      `${student.rowNumber}. ${student.name}`,
      '',
      '',
    ]),
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    margin: {
      top: ATTENDANCE_TEMPLATE_TABLE_TOP_MM,
      right: PAGE_MARGIN,
      bottom: 18,
      left: PAGE_MARGIN,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: INK,
      fillColor: PAPER_LIGHT,
      lineColor: INK,
      lineWidth: 0.3,
      cellPadding: 2.1,
      minCellHeight: ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM,
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PAPER_MUTED,
      textColor: INK,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: INK,
      lineWidth: 0.35,
      minCellHeight: ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM,
    },
    columnStyles: {
      0: { cellWidth: ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM, halign: 'left' },
      1: { cellWidth: ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM, halign: 'center' },
      2: { cellWidth: ATTENDANCE_TEMPLATE_REMARKS_COLUMN_WIDTH_MM, halign: 'left' },
    },
    willDrawPage: () => drawAttendanceTemplateHeader(document, template),
  });
}

// Draws one horizontal continuation of the combined blank Student/date/Remarks matrix.
export function appendPrintableAttendanceMatrixTable(
  document: jsPDF,
  matrix: PrintableAttendanceMatrix,
  dateChunk: readonly PrintableAttendanceMatrixDate[],
  studentChunk: readonly PrintableAttendanceMatrixStudent[],
  renderTable: AutoTableRenderer,
) {
  const headers = ['Student', ...dateChunk.map((date) => date.label), 'Remarks'];
  const usableBodyHeight = document.internal.pageSize.getHeight() -
    PRINTABLE_MATRIX_TABLE_TOP - ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM - 18 -
    PRINTABLE_MATRIX_PAGE_SAFETY_GAP;
  const rowsPerPage = getPrintableAttendanceMatrixRowsPerPage(matrix.students.length);
  const rowHeight = Math.min(
    ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM,
    usableBodyHeight / rowsPerPage,
  );
  const dateColumnWidth = dateChunk.length > 0
    ? Math.min(35, PRINTABLE_MATRIX_DATE_COLUMNS_TOTAL_WIDTH / dateChunk.length)
    : PRINTABLE_MATRIX_DATE_COLUMNS_TOTAL_WIDTH / DATE_COLUMNS_PER_PAGE;
  const remarksColumnWidth = PRINTABLE_MATRIX_REMARKS_COLUMN_WIDTH +
    PRINTABLE_MATRIX_DATE_COLUMNS_TOTAL_WIDTH - (dateColumnWidth * dateChunk.length);
  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' }> = {
    0: { cellWidth: PRINTABLE_MATRIX_STUDENT_COLUMN_WIDTH, halign: 'left' },
    [headers.length - 1]: {
      cellWidth: remarksColumnWidth,
      halign: 'left',
    },
  };

  dateChunk.forEach((_, index) => {
    columnStyles[index + 1] = { cellWidth: dateColumnWidth, halign: 'center' };
  });

  renderTable(document, {
    startY: PRINTABLE_MATRIX_TABLE_TOP,
    head: [headers],
    body: studentChunk.map((student) => [
      `${student.rowNumber}. ${student.name}`,
      ...dateChunk.map((date) => student.rosterDateIds.includes(date.id) ? '' : '-'),
      '',
    ]),
    theme: 'grid',
    showHead: 'firstPage',
    rowPageBreak: 'avoid',
    margin: {
      top: PRINTABLE_MATRIX_TABLE_TOP,
      right: PAGE_MARGIN,
      bottom: 18,
      left: PAGE_MARGIN,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: INK,
      fillColor: PAPER_LIGHT,
      lineColor: INK,
      lineWidth: 0.3,
      cellPadding: 1.8,
      minCellHeight: rowHeight,
      overflow: 'ellipsize',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PAPER_MUTED,
      textColor: INK,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: INK,
      lineWidth: 0.35,
      minCellHeight: ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM,
    },
    alternateRowStyles: { fillColor: PAPER_ALTERNATE },
    columnStyles,
    willDrawPage: () => drawPrintableAttendanceMatrixHeader(document, matrix),
  });
}

// Adds the status legend and stable page numbering after every table is complete.
export function drawAttendanceReportFooters(document: jsPDF) {
  const pageCount = document.getNumberOfPages();
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    document.setFont('helvetica', 'normal');
    document.setFontSize(6.5);
    document.setTextColor(...INK);
    document.text(
      'P Present | A Absent | L Late | E Excused | - Unmarked or not in roster',
      PAGE_MARGIN,
      pageHeight - 6,
    );
    document.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 6,
      { align: 'right' },
    );
  }
}

// Adds one legend and document-wide page sequence to the combined printable matrix.
export function drawPrintableAttendanceMatrixFooters(document: jsPDF) {
  const pageCount = document.getNumberOfPages();
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    document.setFont('helvetica', 'normal');
    document.setFontSize(6.5);
    document.setTextColor(...INK);
    document.text(
      'P Present | A Absent | L Late | E Excused | blank Unmarked | - Not in roster',
      PAGE_MARGIN,
      pageHeight - 6,
    );
    document.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 6,
      { align: 'right' },
    );
  }
}

// Labels one date template's physical page range with its legend and relative page identity.
export function drawAttendanceTemplateFooters(
  document: jsPDF,
  template: PrintableAttendanceTemplate,
  firstDocumentPage = 1,
  lastDocumentPage = document.getNumberOfPages(),
) {
  const pageCount = lastDocumentPage - firstDocumentPage + 1;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  for (
    let documentPageNumber = firstDocumentPage;
    documentPageNumber <= lastDocumentPage;
    documentPageNumber += 1
  ) {
    const pageNumber = documentPageNumber - firstDocumentPage + 1;
    document.setPage(documentPageNumber);
    document.setFont('helvetica', 'normal');
    document.setFontSize(6.5);
    document.setTextColor(...INK);
    const rowRange = getAttendanceTemplatePageRowRange(
      pageNumber,
      template.students.length,
    );
    const identityModules = encodeAttendanceTemplatePageIdentity(
      template.templateReference,
      pageNumber,
      pageCount,
    );
    const identityStripWidth = identityModules.length *
      ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM;
    document.setFillColor(...PAPER_LIGHT);
    document.rect(
      ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM - 2,
      ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM - 0.5,
      identityStripWidth + 4,
      ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM + 1,
      'F',
    );
    document.setFillColor(...INK);
    identityModules.forEach((isFilled, moduleIndex) => {
      if (isFilled) {
        document.rect(
          ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM +
            (moduleIndex * ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM),
          ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM,
          ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM,
          ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM,
          'F',
        );
      }
    });
    document.text(
      `PALE OCR V${template.templateVersion} | REF ${template.templateReference} | PAGE ${pageNumber}/${pageCount} | ROWS ${rowRange.firstRowNumber}-${rowRange.lastRowNumber}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: 'center' },
    );
    document.text(
      'P Present | A Absent | L Late | E Excused | Write one code per student',
      PAGE_MARGIN + 4,
      pageHeight - 6,
    );
    document.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 6,
      { align: 'right' },
    );
  }
}
