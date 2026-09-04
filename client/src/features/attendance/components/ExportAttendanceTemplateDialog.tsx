// Selects and exports one or more blank Attendance templates for manual marking.
import { useState } from 'react';
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

// Provides one review point before opening or downloading the selected date templates.
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
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('download')}
            isLoading={exportAction === 'download'}
            disabled={isExporting || selectedSessionIds.size === 0}
          >
            Download PDF
          </Button>
          <Button
            onClick={() => handleExport('open')}
            isLoading={exportAction === 'open'}
            disabled={isExporting || selectedSessionIds.size === 0}
          >
            Open printable PDF
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Template not generated" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      <div className="space-y-5">
        <Notice variant="info" title="Blank manual attendance sheets">
          Each selected date uses its own roster and starts on a new PDF page. Saved and unsaved
          attendance marks are not included.
        </Notice>

        <dl className="grid gap-px border border-ink bg-ink sm:grid-cols-3">
          <div className="bg-paper-light p-4">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Selected dates
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink" aria-live="polite">
              {selectedSessionIds.size}
            </dd>
          </div>
          <div className="bg-paper-light p-4">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Printable dates
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
              {printableSessionIds.length}
            </dd>
          </div>
          <div className="bg-paper-light p-4">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Print format
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">A4 landscape PDF</dd>
          </div>
        </dl>

        <section aria-labelledby="attendance-template-dates-heading">
          <div className="flex flex-col gap-3 border border-ink bg-paper-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="attendance-template-dates-heading" className="text-sm font-semibold text-ink">
                Attendance dates
              </h3>
              <p className="mt-1 text-sm leading-5 text-ink-secondary">
                {isCurrentSessionPrintable
                  ? 'The currently viewed date is selected first. Choose any other dates to include.'
                  : 'The currently viewed date has no students. Choose another printable date.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isExporting || allPrintableSessionsSelected}
                onClick={() => {
                  setSelectedSessionIds(new Set(printableSessionIds));
                  setErrorMessage('');
                }}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isExporting || selectedSessionIds.size === 0}
                onClick={() => {
                  setSelectedSessionIds(new Set());
                  setErrorMessage('');
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto border-x border-b border-ink bg-paper-light">
            {orderedSessions.map((session) => {
              const rosterSize = getAttendanceSessionRoster(session).length;
              const isPrintable = rosterSize > 0;
              const isCurrentSession = session.id === selectedSessionId;

              return (
                <li
                  key={session.id}
                  className="border-b border-paper-border p-4 last:border-b-0"
                >
                  <Checkbox
                    id={`attendance-template-date-${session.id}`}
                    checked={selectedSessionIds.has(session.id)}
                    disabled={isExporting || !isPrintable}
                    onChange={(isSelected) => updateSessionSelection(session.id, isSelected)}
                    label={
                      <span className="flex flex-wrap items-center gap-2 font-sans text-sm normal-case tracking-normal">
                        <span>{formatAttendanceDateLong(session.sessionDate, dateFormat)}</span>
                        {isCurrentSession ? (
                          <span className="border border-ink bg-paper-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
                            Current
                          </span>
                        ) : null}
                      </span>
                    }
                    description={isPrintable
                      ? `${rosterSize} ${rosterSize === 1 ? 'student' : 'students'} / ${formatAttendanceSessionSchedule(session, timeFormat)}`
                      : 'No students in this roster; this date cannot be printed.'}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="border border-paper-border bg-paper p-4">
          <h3 className="text-sm font-semibold text-ink">How to complete each sheet</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-ink-secondary">
            <li>Write one clear uppercase P, A, L, or E in each student's date cell.</li>
            <li>Leave the date cell blank when attendance is still unmarked.</li>
            <li>Add a remark whenever a student is marked E for Excused.</li>
            <li>When scanning, keep all four corner squares and the bottom identity strip visible.</li>
          </ol>
        </div>

        <p className="text-sm leading-6 text-ink-secondary">
          Select at least one date. Open printable PDF uses one new browser tab for immediate
          printing; Download PDF saves one combined file on this device.
        </p>
      </div>
    </Dialog>
  );
}
