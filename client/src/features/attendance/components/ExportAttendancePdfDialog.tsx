// Confirms monthly Attendance PDF scope, warnings, generation, and download.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import {
  buildMonthlyAttendanceReport,
  formatAttendanceReportDate,
  formatAttendanceReportMonth,
} from '../attendance-report';
import type { AttendanceSessionDraft } from '../attendance-types';

interface ExportAttendancePdfDialogProps {
  classRecord: ClassRecord;
  monthInput: string;
  sessions: AttendanceSessionDraft[];
  createdBy: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
}

// Generates one PDF after the user reviews any unsaved-date or unsaved-edit warnings.
export function ExportAttendancePdfDialog({
  classRecord,
  monthInput,
  sessions,
  createdBy,
  hasUnsavedChanges,
  onClose,
}: ExportAttendancePdfDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const unsavedDates = sessions
    .filter((session) => !session.isRosterInitialized)
    .map((session) => formatAttendanceReportDate(session.sessionDate));

  // Prevents closing while the browser is assembling the downloadable file.
  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  // Builds the saved-data report and loads the heavy PDF code only on demand.
  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage('');

    try {
      const report = buildMonthlyAttendanceReport({
        classRecord,
        monthInput,
        sessions,
        createdBy,
        createdAt: new Date(),
        hasUnsavedChanges,
      });
      const { downloadMonthlyAttendancePdf } = await import('../attendance-pdf');
      await downloadMonthlyAttendancePdf(report);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to generate the attendance PDF. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title="Export attendance PDF"
      description={`${classRecord.subjectName} / ${formatAttendanceReportMonth(monthInput)}`}
      isDismissDisabled={isExporting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isExporting}>
            {isExporting ? 'Generating PDF' : 'Export PDF'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="PDF not generated" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      {unsavedDates.length > 0 ? (
        <Notice variant="warning" title="Unsaved dates will be included" className="mb-5">
          The following dates have no saved roster yet: {unsavedDates.join(', ')}. They will
          appear in the PDF with hyphens instead of attendance values.
        </Notice>
      ) : null}

      {hasUnsavedChanges ? (
        <Notice variant="warning" title="Current edits are not included" className="mb-5">
          The PDF uses the last saved attendance values. Save or cancel the open edits if you
          need the report to match the current screen.
        </Notice>
      ) : null}

      <p className="text-sm leading-6 text-ink-secondary">
        The PDF contains student names, month/day attendance columns, and Remarks as the last
        column. Student numbers, proof attachments, and P/A/L/E totals are excluded.
      </p>
    </Dialog>
  );
}
