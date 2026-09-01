// Composes the Attendance workspace from feature-owned state, actions, and UI components.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Notice";
import { Header } from "../components/ui/Header";

import {
  getAuthenticatedUserDisplayName,
  type AuthenticatedUser,
} from "../features/auth/auth-api";
import { AttendanceDetailsDialog } from "../features/attendance/components/AttendanceDetailsDialog";
import { AttendanceRegister } from "../features/attendance/components/AttendanceRegister";
import { DeleteAttendanceSessionDialog } from "../features/attendance/components/DeleteAttendanceSessionDialog";
import { ExportAttendanceDialog } from "../features/attendance/components/ExportAttendancePdfDialog";
import {
  AttendanceToolbar,
  type AttendanceToolbarFeedback,
} from "../features/attendance/components/AttendanceToolbar";
import { useAttendanceWorkspace } from "../features/attendance/useAttendanceWorkspace";
import { useSystemPreferences } from "../features/settings/system-preferences-store";

interface AttendancePageProps {
  currentUser: AuthenticatedUser;
  onSessionExpired: () => void;
}

// Provides the Attendance symbol used by honest empty workspace states.
function AttendanceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M4 9h16M8 15l2 2 5-5" />
    </svg>
  );
}

// Renders Attendance workspace states and delegates workflow behavior to its feature hook.
export function AttendancePage({ currentUser, onSessionExpired }: AttendancePageProps) {
  const navigate = useNavigate();
  const { preferences } = useSystemPreferences();
  const attendance = useAttendanceWorkspace(
    onSessionExpired,
    preferences?.defaultAttendanceState,
    preferences?.dateFormat,
  );
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const canExportAttendance = Boolean(
    attendance.selectedClass &&
    attendance.sessionLoadStatus === "ready" &&
    attendance.selectedClassSessions.length > 0 &&
    !attendance.isBusy,
  );

  const toolbarFeedback: AttendanceToolbarFeedback | null = attendance.feedback
    ? {
        variant: attendance.feedback.variant,
        title: attendance.feedback.title,
        content:
          attendance.feedback.messages.length === 1 ? (
            attendance.feedback.messages[0]
          ) : (
            <ul className="list-disc space-y-1 pl-4">
              {attendance.feedback.messages.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          ),
      }
    : null;

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Attendance"
        workspaceDescription="Open a class month to create scheduled dates, then save each date’s roster deliberately."
        actionButton={
          <Button
            variant="secondary"
            aria-haspopup="dialog"
            disabled={!canExportAttendance}
            title={canExportAttendance
              ? "Export the selected class month"
              : "Select and load a class month with attendance dates before exporting"}
            onClick={() => setIsExportDialogOpen(true)}
          >
            Export attendance
          </Button>
        }
      />

      <div className="archival-grid min-h-[calc(100vh-185px)] min-w-0">
        <div className="mx-auto min-w-0 max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {attendance.loadStatus === "loading" ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p
                role="status"
                className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Loading attendance workspace…
              </p>
            </div>
          ) : null}

          {attendance.loadStatus === "error" ? (
            <Notice variant="error" title="Attendance workspace unavailable">
              <div className="space-y-4">
                <p>{attendance.loadError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={attendance.handleRetryLoad}>
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {attendance.loadStatus === "ready" &&
          attendance.classes.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<AttendanceIcon />}
                title="No classes available"
                description="Add an active class before opening an attendance register."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/dashboard/classes")}>
                    Go to classes
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {attendance.loadStatus === "ready" &&
          attendance.classes.length > 0 ? (
            <div className="min-w-0 space-y-8">
              <AttendanceToolbar
                classes={attendance.classes}
                selectedClassId={attendance.selectedClassId}
                monthInput={attendance.monthInput}
                dateInput={attendance.dateInput}
                selectedDate={attendance.selectedDate}
                selectedSession={attendance.selectedSessionDraft ?? null}
                isEditing={attendance.isEditing}
                hasUnsavedChanges={attendance.hasUnsavedChanges}
                isBusy={attendance.isBusy}
                isCreating={attendance.isCreating}
                isSaving={attendance.isSaving}
                canUndo={attendance.canUndo}
                canAddDate={attendance.canAddDate}
                dateHint={attendance.dateHint}
                statusCounts={attendance.statusCounts}
                feedback={toolbarFeedback}
                dateFormat={preferences?.dateFormat}
                timeFormat={preferences?.timeFormat}
                onClassChange={attendance.handleClassChange}
                onMonthInputChange={attendance.handleMonthChange}
                onDateInputChange={attendance.handleDateInputChange}
                onAddDate={attendance.handleAddDate}
                onEdit={attendance.handleEdit}
                onDelete={attendance.handleOpenDelete}
                onMarkUnmarkedPresent={attendance.handleMarkUnmarkedPresent}
                onUndo={attendance.handleUndo}
                onCancel={attendance.handleCancel}
                onSave={attendance.handleSave}
              />

              {!attendance.selectedClass ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No class selected"
                    description="Select an active class to generate and load attendance dates for the calendar month."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {attendance.selectedClass &&
              attendance.sessionLoadStatus === "loading" ? (
                <div className="border border-ink bg-paper-light px-5 py-10 text-center">
                  <p
                    role="status"
                    className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    Generating and loading attendance dates…
                  </p>
                </div>
              ) : null}

              {attendance.selectedClass &&
              attendance.sessionLoadStatus === "error" ? (
                <Notice variant="error" title="Attendance month unavailable">
                  <div className="space-y-4">
                    <p>{attendance.sessionLoadError}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={attendance.handleRetrySessionLoad}>
                      Try again
                    </Button>
                  </div>
                </Notice>
              ) : null}

              {attendance.selectedClass &&
              attendance.sessionLoadStatus === "ready" &&
              attendance.selectedClassSessions.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No attendance dates this month"
                    description="This generated month has no scheduled dates. Manual Add date remains available for past, makeup, or unscheduled attendance."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {attendance.selectedClass &&
              attendance.sessionLoadStatus === "ready" &&
              attendance.selectedClassSessions.length > 0 &&
              attendance.selectedSessionId &&
              attendance.selectedRoster.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No students in this roster"
                    description={
                      attendance.selectedSessionDraft?.isRosterInitialized
                        ? "This saved historical roster contains no students."
                        : "This attendance date has no currently enrolled students. Viewing it has not created attendance records."
                    }
                    action={
                      !attendance.selectedSessionDraft?.isRosterInitialized ? (
                        <Button
                          variant="secondary"
                          onClick={() => navigate("/dashboard/students")}>
                          Go to students
                        </Button>
                      ) : undefined
                    }
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {attendance.selectedClass &&
              attendance.sessionLoadStatus === "ready" &&
              attendance.selectedClassSessions.length > 0 &&
              attendance.selectedSessionId &&
              attendance.selectedRoster.length > 0 ? (
                <AttendanceRegister
                  roster={attendance.selectedRoster}
                  sessionDrafts={attendance.selectedClassSessions}
                  selectedSessionId={attendance.selectedSessionId}
                  isEditing={attendance.isEditing}
                  liveMessage={attendance.liveMessage}
                  dateFormat={preferences?.dateFormat}
                  tableDensity={preferences?.tableDensity}
                  onSelectSession={attendance.handleSelectSession}
                  onCycleStatus={attendance.handleCycleStatus}
                  onOpenDetails={attendance.handleOpenDetails}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {attendance.detailsTarget &&
      attendance.selectedClass &&
      attendance.selectedSessionDraft &&
      attendance.detailsRecord ? (
        <AttendanceDetailsDialog
          key={`${attendance.selectedClass.id}-${attendance.selectedSessionDraft.id}-${attendance.detailsTarget.id}-${attendance.isEditing ? "edit" : "review"}`}
          student={attendance.detailsTarget}
          classRecord={attendance.selectedClass}
          date={attendance.selectedSessionDraft.sessionDate}
          record={attendance.detailsRecord}
          isEditable={attendance.isEditing}
          dateFormat={preferences?.dateFormat}
          onClose={attendance.handleCloseDetails}
          onApply={attendance.handleApplyDetails}
        />
      ) : null}

      {attendance.deleteTarget ? (
        <DeleteAttendanceSessionDialog
          key={attendance.deleteTarget.id}
          session={attendance.deleteTarget}
          dateFormat={preferences?.dateFormat}
          onClose={attendance.handleCloseDelete}
          onDeleted={attendance.handleDeletedSession}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {isExportDialogOpen && attendance.selectedClass ? (
        <ExportAttendanceDialog
          key={`${attendance.selectedClass.id}-${attendance.monthInput}`}
          classRecord={attendance.selectedClass}
          monthInput={attendance.monthInput}
          sessions={attendance.selectedClassSessions}
          createdBy={getAuthenticatedUserDisplayName(currentUser)}
          hasUnsavedChanges={attendance.hasUnsavedChanges}
          defaultFormat={preferences?.defaultExportFormat ?? 'PDF'}
          dateFormat={preferences?.dateFormat}
          onClose={() => setIsExportDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
