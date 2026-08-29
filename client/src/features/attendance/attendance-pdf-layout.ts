// Owns the compact monthly Attendance PDF page, table, and typography layout.
import type { jsPDF } from 'jspdf';
import type { AttendanceReportDate, MonthlyAttendanceReport } from './attendance-report';

type AutoTableRenderer = typeof import('jspdf-autotable').autoTable;

const PAGE_MARGIN = 10;
const REPORT_HEADER_BOTTOM = 43;
const DATE_COLUMNS_PER_PAGE = 10;
const STUDENT_COLUMN_WIDTH = 48;
const DATE_COLUMNS_TOTAL_WIDTH = 150;
const REMARKS_COLUMN_WIDTH = 79;
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
