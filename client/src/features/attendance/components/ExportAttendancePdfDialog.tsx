// Confirms monthly Attendance export scope, format choice, warnings, and download.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import { Select } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import { formatDateOnly, type DateFormatPreference } from '../../settings/preference-display';
import type { SystemPreferences } from '../../settings/settings-types';
import {
  buildMonthlyAttendanceReport,
  formatAttendanceReportMonth,
} from '../attendance-report';
import type { AttendanceSessionDraft } from '../attendance-types';

interface ExportAttendanceDialogProps {
  classRecord: ClassRecord;
  monthInput: string;
  sessions: AttendanceSessionDraft[];
  createdBy: string;
  hasUnsavedChanges: boolean;
  defaultFormat: SystemPreferences['defaultExportFormat'];
  dateFormat?: DateFormatPreference;
  onClose: () => void;
}

// Generates one chosen file after the user reviews saved-data export warnings.
export function ExportAttendanceDialog({
  classRecord,
  monthInput,
  sessions,
  createdBy,
  hasUnsavedChanges,
  defaultFormat,
  dateFormat,
  onClose,
}: ExportAttendanceDialogProps) {
  const [format, setFormat] = useState(defaultFormat);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const unsavedDates = sessions
    .filter((session) => !session.isRosterInitialized)
    .map((session) => formatDateOnly(session.sessionDate, dateFormat));
  const formatLabel = format === 'PDF' ? 'PDF' : 'CSV';

  // Prevents closing while the browser is assembling the downloadable file.
  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  // Builds one saved-data report, then hands it to the selected local exporter.
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
      if (format === 'PDF') {
        const { downloadMonthlyAttendancePdf } = await import('../attendance-pdf');
        await downloadMonthlyAttendancePdf(report);
      } else {
        const { downloadMonthlyAttendanceCsv } = await import('../attendance-csv');
        downloadMonthlyAttendanceCsv(report);
      }
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Unable to generate the attendance ${formatLabel}. Please try again.`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title="Export attendance"
      description={`${classRecord.subjectName} / ${formatAttendanceReportMonth(monthInput)}`}
      isDismissDisabled={isExporting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isExporting}>
            {isExporting ? `Generating ${formatLabel}` : `Export ${formatLabel}`}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title={`${formatLabel} not generated`} className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      {unsavedDates.length > 0 ? (
        <Notice variant="warning" title="Unsaved dates will be included" className="mb-5">
          The following dates have no saved roster yet: {unsavedDates.join(', ')}. They will
          appear in the {formatLabel} with hyphens instead of attendance values.
        </Notice>
      ) : null}

      {hasUnsavedChanges ? (
        <Notice variant="warning" title="Current edits are not included" className="mb-5">
          The {formatLabel} uses the last saved attendance values. Save or cancel the open edits if you
          need the report to match the current screen.
        </Notice>
      ) : null}

      <div className="space-y-5">
        <Select
          id="attendance-export-format"
          label="File format"
          value={format}
          disabled={isExporting}
          onChange={(event) => {
            setFormat(event.target.value as SystemPreferences['defaultExportFormat']);
            setErrorMessage('');
          }}
          options={[
            { value: 'PDF', label: 'PDF — print-ready report' },
            { value: 'CSV', label: 'CSV — spreadsheet-compatible data' },
          ]}
          hint="This one-off choice does not change your saved System preference."
        />

        <p className="text-sm leading-6 text-ink-secondary">
          The export contains the existing report metadata, student names, month/day attendance
          columns, and Remarks as the last column. Student numbers, proof attachments, and
          P/A/L/E totals are excluded.
        </p>
      </div>
    </Dialog>
  );
}
