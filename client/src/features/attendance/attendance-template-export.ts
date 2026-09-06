// Exports combined print matrices and scan-ready Attendance sheets through pop-up-safe paths.
import type { ClassRecord } from '../classes/class-types';
import { getAttendanceSessionRoster } from './attendance-draft';
import {
  buildPrintableAttendanceMatrix,
  buildPrintableAttendanceTemplate,
} from './attendance-template';
import type { AttendanceSessionDraft } from './attendance-types';

export type AttendanceTemplateExportAction = 'open' | 'download';

interface ExportPrintableAttendanceTemplatesInput {
  action: AttendanceTemplateExportAction;
  classRecord: ClassRecord;
  sessions: AttendanceSessionDraft[];
  createdBy: string;
}

interface ExportScannableAttendanceTemplateInput {
  action: AttendanceTemplateExportAction;
  classRecord: ClassRecord;
  session: AttendanceSessionDraft;
  createdBy: string;
}

function openAttendancePdfPreview(action: AttendanceTemplateExportAction) {
  if (action !== 'open') {
    return null;
  }

  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    throw new Error(
      'The browser blocked the printable PDF window. Allow pop-ups or download the PDF instead.',
    );
  }

  return previewWindow;
}

// Builds one chronological Student/date/Remarks matrix for every selected print date.
export async function exportPrintableAttendanceTemplates({
  action,
  classRecord,
  sessions,
  createdBy,
}: ExportPrintableAttendanceTemplatesInput) {
  let previewWindow: Window | null = null;

  try {
    const orderedSessions = Array.from(
      new Map(sessions.map((session) => [session.id, session])).values(),
    ).toSorted((left, right) => left.sessionDate.localeCompare(right.sessionDate));
    if (
      orderedSessions.length === 0 ||
      orderedSessions.some((session) => getAttendanceSessionRoster(session).length === 0)
    ) {
      throw new Error('Select at least one attendance date with students before printing.');
    }

    const matrix = buildPrintableAttendanceMatrix({
      classRecord,
      sessions: orderedSessions,
      createdBy,
      createdAt: new Date(),
    });
    previewWindow = openAttendancePdfPreview(action);

    const {
      downloadPrintableAttendanceMatrixPdf,
      openPrintableAttendanceMatrixPdf,
    } = await import('./attendance-pdf');

    if (action === 'open') {
      await openPrintableAttendanceMatrixPdf(matrix, previewWindow);
    } else {
      await downloadPrintableAttendanceMatrixPdf(matrix);
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}

// Keeps the Import file workflow on the fixed one-date layout required by local OCR.
export async function exportScannableAttendanceTemplate({
  action,
  classRecord,
  session,
  createdBy,
}: ExportScannableAttendanceTemplateInput) {
  let previewWindow: Window | null = null;

  try {
    const template = buildPrintableAttendanceTemplate({
      classRecord,
      session,
      createdBy,
      createdAt: new Date(),
    });
    if (template.students.length === 0) {
      throw new Error('A selected attendance date with students is required before printing.');
    }

    previewWindow = openAttendancePdfPreview(action);
    const {
      downloadPrintableAttendanceTemplatesPdf,
      openPrintableAttendanceTemplatesPdf,
    } = await import('./attendance-pdf');

    if (action === 'open') {
      await openPrintableAttendanceTemplatesPdf([template], previewWindow);
    } else {
      await downloadPrintableAttendanceTemplatesPdf([template], template.filename);
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
