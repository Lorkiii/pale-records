// Builds and downloads saved-data Attendance CSV files from the shared monthly report.
import type {
  AttendanceReportStudentRow,
  MonthlyAttendanceReport,
} from './attendance-report';
import { escapeAttendanceCsvField } from './attendance-csv-field';

// Mirrors the PDF Remarks column across the report's complete date matrix.
function getStudentRemarks(
  report: MonthlyAttendanceReport,
  student: AttendanceReportStudentRow,
) {
  return report.dates
    .map((date) => {
      const remark = student.remarkByDateId[date.id];
      return remark ? `${date.label}: ${remark}` : '';
    })
    .filter(Boolean)
    .join('\n') || '-';
}

// Serializes the existing report metadata and saved attendance matrix as text/csv.
export function createMonthlyAttendanceCsv(report: MonthlyAttendanceReport) {
  const rows: string[][] = [
    ['Month', report.monthYear],
    ['Subject', report.subject],
    ['Subject Code', report.subjectCode?.trim() || '-'],
    ['School Year and Sem', report.schoolYearAndSemester?.trim() || '-'],
    ['Created By', report.createdBy],
    ['Date Created', report.dateCreated],
    [],
    ['Student', ...report.dates.map((date) => date.label), 'Remarks'],
    ...report.students.map((student) => [
      student.name,
      ...report.dates.map((date) => student.statusByDateId[date.id] ?? '-'),
      getStudentRemarks(report, student),
    ]),
  ];

  return rows
    .map((row) => row.map((field) => escapeAttendanceCsvField(field)).join(','))
    .join('\r\n');
}

// Starts a local browser download and releases its temporary object URL afterward.
export function downloadMonthlyAttendanceCsv(report: MonthlyAttendanceReport) {
  const csv = createMonthlyAttendanceCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = report.filename.replace(/\.pdf$/i, '.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
