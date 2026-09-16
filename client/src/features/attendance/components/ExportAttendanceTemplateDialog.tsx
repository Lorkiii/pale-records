// Selects and exports one or more blank Attendance templates for manual marking.
import { useState } from 'react';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import type {
  DateFormatPreference,
  TimeFormatPreference,
} from '../../settings/preference-display';
import {
  formatAttendanceDateLong,
  formatAttendanceSessionSchedule,
  getAttendanceSessionRoster,
} from '../attendance-draft';
import {
  exportPrintableAttendanceTemplates,
  type AttendanceTemplateExportAction,
} from '../attendance-template-export';
import type { AttendanceSessionDraft } from '../attendance-types';

interface ExportAttendanceTemplateDialogProps {
  classRecord: ClassRecord;
  sessions: AttendanceSessionDraft[];
  selectedSessionId: string;
  createdBy: string;
  dateFormat?: DateFormatPreference;
  timeFormat?: TimeFormatPreference;
  onClose: () => void;
}

// Selects dates for one combined printable Attendance table and explains its manual workflow.
export function ExportAttendanceTemplateDialog({
  classRecord,
  sessions,
  selectedSessionId,
  createdBy,
  dateFormat,
  timeFormat,
  onClose,
}: ExportAttendanceTemplateDialogProps) {
  const orderedSessions = sessions.toSorted((left, right) =>
    left.sessionDate.localeCompare(right.sessionDate),
  );
  const printableSessionIds = orderedSessions
    .filter((session) => getAttendanceSessionRoster(session).length > 0)
    .map((session) => session.id);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(() =>
    new Set(printableSessionIds.includes(selectedSessionId) ? [selectedSessionId] : []),
  );
  const [exportAction, setExportAction] = useState<AttendanceTemplateExportAction | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const isExporting = exportAction !== null;
  const isCurrentSessionPrintable = printableSessionIds.includes(selectedSessionId);
  const allPrintableSessionsSelected = printableSessionIds.length > 0 &&
    printableSessionIds.every((sessionId) => selectedSessionIds.has(sessionId));

  const updateSessionSelection = (sessionId: string, isSelected: boolean) => {
    setSelectedSessionIds((currentSessionIds) => {
      const nextSessionIds = new Set(currentSessionIds);
      if (isSelected) {
        nextSessionIds.add(sessionId);
      } else {
        nextSessionIds.delete(sessionId);
      }
      return nextSessionIds;
    });
    setErrorMessage('');
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  const handleExport = async (action: AttendanceTemplateExportAction) => {
    const selectedSessions = orderedSessions.filter((session) =>
      selectedSessionIds.has(session.id),
    );
    if (selectedSessions.length === 0) {
      return;
    }

    setExportAction(action);
    setErrorMessage('');

    try {
      await exportPrintableAttendanceTemplates({
        action,
        classRecord,
        sessions: selectedSessions,
        createdBy,
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to generate the printable attendance template. Please try again.',
      );
    } finally {
      setExportAction(null);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title="Print attendance templates"
      description={`${classRecord.subjectName} / Choose dates from the loaded attendance month`}
      isDismissDisabled={isExporting}
      footer={
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <Button
            className="min-w-0 flex-1 px-3 text-xs sm:flex-none"
            onClick={() => handleExport('open')}
            isLoading={exportAction === 'open'}
            disabled={isExporting || selectedSessionIds.size === 0}
          >
            Open PDF
          </Button>
          <ActionIconButton
            icon="download"
            label="Download PDF"
            tooltip="Download PDF"
            variant="secondary"
            onClick={() => handleExport('download')}
            isLoading={exportAction === 'download'}
            disabled={isExporting || selectedSessionIds.size === 0}
          />
          <ActionIconButton
            icon="cancel"
            label="Cancel"
            tooltip="Cancel"
            variant="ghost"
            onClick={handleClose}
            disabled={isExporting}
          />
        </div>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Template not generated" className="mb-3">
          {errorMessage}
        </Notice>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm leading-5 text-ink-secondary">
          Print selected dates in one blank Student/date/Remarks table. Attendance marks are not included.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-ink-secondary">
          <p aria-live="polite" aria-atomic="true">
            <span className="font-semibold tabular-nums text-ink">
              {selectedSessionIds.size} of {printableSessionIds.length}
            </span>{' '}printable dates selected
          </p>
          <p className="text-xs">A4 landscape PDF</p>
        </div>

        <section aria-labelledby="attendance-template-dates-heading">
          <div className="border border-ink bg-paper-muted px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="attendance-template-dates-heading" className="min-w-0 text-sm font-semibold text-ink">
                Attendance dates
              </h3>
              <div className="flex shrink-0 gap-1">
                <ActionIconButton
                  icon="mark-all"
                  label="Select all printable dates"
                  tooltip="Select all printable dates"
                  variant="secondary"
                  disabled={isExporting || printableSessionIds.length === 0 || allPrintableSessionsSelected}
                  onClick={() => {
                    setSelectedSessionIds(new Set(printableSessionIds));
                    setErrorMessage('');
                  }}
                />
                <ActionIconButton
                  icon="cancel"
                  label="Clear selection"
                  tooltip="Clear selection"
                  variant="ghost"
                  disabled={isExporting || selectedSessionIds.size === 0}
                  onClick={() => {
                    setSelectedSessionIds(new Set());
                    setErrorMessage('');
                  }}
                />
              </div>
            </div>
            <p className="mt-1 text-sm leading-5 text-ink-secondary">
              {isCurrentSessionPrintable
                ? 'Choose at least one date to print.'
                : 'The current date has no students. Choose another date to print.'}
            </p>
          </div>

          <ul className="max-h-72 overflow-y-auto border-x border-b border-ink bg-paper-light">
            {orderedSessions.map((session) => {
              const rosterSize = getAttendanceSessionRoster(session).length;
              const isPrintable = rosterSize > 0;
              const isCurrentSession = session.id === selectedSessionId;

              return (
                <li
                  key={session.id}
                  className="border-b border-paper-border px-3 py-2.5 last:border-b-0"
                >
                  <Checkbox
                    id={`attendance-template-date-${session.id}`}
                    checked={selectedSessionIds.has(session.id)}
                    disabled={isExporting || !isPrintable}
                    onChange={(isSelected) => updateSessionSelection(session.id, isSelected)}
                    label={
                      <span className="flex min-h-11 flex-col justify-center gap-1 font-sans text-sm normal-case tracking-normal">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{formatAttendanceDateLong(session.sessionDate, dateFormat)}</span>
                          {isCurrentSession ? (
                            <span className="border border-ink bg-paper-muted px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
                              Current
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs font-normal leading-4 text-ink-secondary">
                          {isPrintable
                            ? `${rosterSize} ${rosterSize === 1 ? 'student' : 'students'} / ${formatAttendanceSessionSchedule(session, timeFormat)}`
                            : 'No students in this roster; this date cannot be printed.'}
                        </span>
                      </span>
                    }
                    className="[&>div:last-child]:min-w-0 [&>div:last-child]:flex-1 [&_label]:block"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <details className="border border-paper-border bg-paper px-3">
          <summary className="min-h-11 cursor-pointer content-center py-2 text-sm font-semibold text-ink">
            Printing instructions
          </summary>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-5 text-ink-secondary">
            <li>Write one clear uppercase P, A, L, or E in each applicable date cell.</li>
            <li>Leave the date cell blank when attendance is still unmarked.</li>
            <li>A dash means the student was not part of that date's roster.</li>
            <li>For E, add the required remark with its date, such as 9/5: Medical.</li>
          </ol>
          <p className="py-3 text-sm leading-5 text-ink-secondary">
            The table continues across PDF pages when needed. Open PDF uses one new browser tab
            for printing; Download PDF saves one combined file on this device. For scan import,
            open Import file on a specific attendance date and use its scan-ready PDF.
          </p>
        </details>
      </div>
    </Dialog>
  );
}
