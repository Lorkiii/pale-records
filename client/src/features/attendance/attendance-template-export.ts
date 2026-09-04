// Builds and exports selected Attendance date templates through one pop-up-safe browser path.
import type { ClassRecord } from '../classes/class-types';
import {
  buildPrintableAttendanceTemplate,
  createPrintableAttendanceTemplatesFilename,
} from './attendance-template';
import type { AttendanceSessionDraft } from './attendance-types';

export type AttendanceTemplateExportAction = 'open' | 'download';

interface ExportPrintableAttendanceTemplatesInput {
  action: AttendanceTemplateExportAction;
  classRecord: ClassRecord;
  sessions: AttendanceSessionDraft[];
  createdBy: string;
}

// Keeps PDF generation lazy while opening one preview tab during the user's click event.
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
    const createdAt = new Date();
    const templates = orderedSessions.map((session) =>
      buildPrintableAttendanceTemplate({
        classRecord,
        session,
        createdBy,
        createdAt,
      }),
    );

    if (templates.length === 0 || templates.some((template) => template.students.length === 0)) {
      throw new Error('Select at least one attendance date with students before printing.');
    }

    const filename = createPrintableAttendanceTemplatesFilename(
      classRecord,
      templates.map((template) => template.attendanceDateIso),
    );

    if (action === 'open') {
      previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        throw new Error(
          'The browser blocked the printable PDF window. Allow pop-ups or download the PDF instead.',
        );
      }
    }

    const {
      downloadPrintableAttendanceTemplatesPdf,
      openPrintableAttendanceTemplatesPdf,
    } = await import('./attendance-pdf');

    if (action === 'open') {
      await openPrintableAttendanceTemplatesPdf(templates, previewWindow);
    } else {
      await downloadPrintableAttendanceTemplatesPdf(templates, filename);
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
