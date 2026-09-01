// Renders the server-backed System preference draft, save, cancel, and confirmed reset workflow.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import PageLoad from '../../../components/ui/PageLoad';
import { Panel } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import {
  resetSystemPreferences,
  SettingsApiError,
  updateSystemPreferences,
} from '../settings-api';
import { useSystemPreferences } from '../system-preferences-store';
import type { AcademicPreferenceOptions, SystemPreferences } from '../settings-types';

interface SystemSettingsTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSessionExpired: () => void;
}

interface SystemPreferencesFormProps extends SystemSettingsTabProps {
  initialPreferences: SystemPreferences;
  academicOptions: AcademicPreferenceOptions;
  adoptPreferences: (preferences: SystemPreferences) => void;
}

type Feedback = {
  variant: 'success' | 'error';
  title: string;
  message: string;
};

function arePreferencesEqual(left: SystemPreferences, right: SystemPreferences) {
  return left.defaultSchoolYear === right.defaultSchoolYear &&
    left.defaultSemester === right.defaultSemester &&
    left.defaultAttendanceState === right.defaultAttendanceState &&
    left.tableDensity === right.tableDensity &&
    left.dateFormat === right.dateFormat &&
    left.timeFormat === right.timeFormat &&
    left.defaultExportFormat === right.defaultExportFormat;
}

function isValidPreferences(preferences: SystemPreferences) {
  return (preferences.defaultSchoolYear === null || preferences.defaultSchoolYear.trim().length > 0) &&
    (preferences.defaultSemester === null || preferences.defaultSemester.trim().length > 0) &&
    ['PRESENT', 'UNRECORDED'].includes(preferences.defaultAttendanceState) &&
    ['COMFORTABLE', 'COMPACT'].includes(preferences.tableDensity) &&
    ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].includes(preferences.dateFormat) &&
    ['12H', '24H'].includes(preferences.timeFormat) &&
    ['PDF', 'CSV'].includes(preferences.defaultExportFormat);
}

function SystemPreferencesForm({
  initialPreferences,
  academicOptions,
  adoptPreferences,
  onDirtyChange,
  onSessionExpired,
}: SystemPreferencesFormProps) {
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences);
  const [draft, setDraft] = useState(initialPreferences);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const requestVersion = useRef(0);
  const isDirty = !arePreferencesEqual(draft, savedPreferences);
  const isValid = isValidPreferences(draft);
  const isBusy = isSaving || isResetting;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => {
    requestVersion.current += 1;
    onDirtyChange(false);
  }, [onDirtyChange]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || !isValid || isBusy) return;

    const currentRequest = requestVersion.current + 1;
    requestVersion.current = currentRequest;
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await updateSystemPreferences(draft);
      if (requestVersion.current !== currentRequest) return;
      setSavedPreferences(saved);
      setDraft(saved);
      adoptPreferences(saved);
      setFeedback({
        variant: 'success',
        title: 'System Preferences Saved',
        message: 'Your per-user System preferences were saved.',
      });
    } catch (error) {
      if (requestVersion.current !== currentRequest) return;
      if (error instanceof SettingsApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setFeedback({
        variant: 'error',
        title: 'System Preferences Not Saved',
        message: error instanceof SettingsApiError
          ? error.message
          : 'Unable to save System preferences right now.',
      });
    } finally {
      if (requestVersion.current === currentRequest) setIsSaving(false);
    }
  };

  const handleConfirmedReset = async () => {
    if (isBusy) return;

    const currentRequest = requestVersion.current + 1;
    requestVersion.current = currentRequest;
    setIsResetting(true);
    setFeedback(null);
    try {
      const reset = await resetSystemPreferences();
      if (requestVersion.current !== currentRequest) return;
      setSavedPreferences(reset);
      setDraft(reset);
      adoptPreferences(reset);
      setIsResetDialogOpen(false);
      setFeedback({
        variant: 'success',
        title: 'System Defaults Restored',
        message: 'Server-owned defaults were restored for your account.',
      });
    } catch (error) {
      if (requestVersion.current !== currentRequest) return;
      setIsResetDialogOpen(false);
      if (error instanceof SettingsApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setFeedback({
        variant: 'error',
        title: 'System Preferences Not Reset',
        message: error instanceof SettingsApiError
          ? error.message
          : 'Unable to reset System preferences right now.',
      });
    } finally {
      if (requestVersion.current === currentRequest) setIsResetting(false);
    }
  };

  const schoolYearOptions = [
    {
      value: '',
      label: academicOptions.schoolYears.length > 0
        ? 'No default academic year'
        : 'No active Class academic years',
    },
    ...academicOptions.schoolYears.map((schoolYear) => ({ value: schoolYear, label: schoolYear })),
  ];
  const semesterOptions = [
    {
      value: '',
      label: academicOptions.semesters.length > 0
        ? 'No default semester'
        : 'No active Class semesters',
    },
    ...academicOptions.semesters.map((semester) => ({ value: semester, label: semester })),
  ];

  return (
    <>
      <form onSubmit={handleSave} className="space-y-8" aria-busy={isBusy || undefined}>
        {feedback ? (
          <Notice
            variant={feedback.variant}
            title={feedback.title}
            onDismiss={() => setFeedback(null)}
          >
            {feedback.message}
          </Notice>
        ) : null}

        <Notice variant="info" title="Preference Scope">
          These saved values now apply to new Class and Attendance defaults, data density,
          displayed dates and times, and Attendance exports.
        </Notice>

        <div className="grid gap-8 lg:grid-cols-2">
          <Panel
            header="Academic Defaults"
            sectionNumber="01"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-ink-secondary">
                Choose from nonempty academic values on currently active Classes. Saved historical choices remain readable.
              </p>
              <Select
                label="Default Academic Year"
                value={draft.defaultSchoolYear ?? ''}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    defaultSchoolYear: event.target.value || null,
                  }));
                  setFeedback(null);
                }}
                options={schoolYearOptions}
              />
              <Select
                label="Default Semester / Term"
                value={draft.defaultSemester ?? ''}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    defaultSemester: event.target.value || null,
                  }));
                  setFeedback(null);
                }}
                options={semesterOptions}
              />
            </div>
          </Panel>

          <Panel
            header="Attendance Default"
            sectionNumber="02"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-ink-secondary">
                Choose the initial state for a new, uninitialized Attendance roster. Saved historical records are never rewritten.
              </p>
              <Select
                label="New Roster Default State"
                value={draft.defaultAttendanceState}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    defaultAttendanceState: event.target.value as SystemPreferences['defaultAttendanceState'],
                  }));
                  setFeedback(null);
                }}
                options={[
                  { value: 'UNRECORDED', label: 'Unrecorded — enter every status explicitly' },
                  { value: 'PRESENT', label: 'Present — record exceptions' },
                ]}
              />
            </div>
          </Panel>

          <Panel
            header="Display & Export"
            sectionNumber="03"
            showCrosshairs={false}
            className="bg-paper-light lg:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Select
                label="Table Density"
                value={draft.tableDensity}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    tableDensity: event.target.value as SystemPreferences['tableDensity'],
                  }));
                  setFeedback(null);
                }}
                options={[
                  { value: 'COMFORTABLE', label: 'Comfortable' },
                  { value: 'COMPACT', label: 'Compact' },
                ]}
              />
              <Select
                label="Date Format"
                value={draft.dateFormat}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    dateFormat: event.target.value as SystemPreferences['dateFormat'],
                  }));
                  setFeedback(null);
                }}
                options={[
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                ]}
              />
              <Select
                label="Time Format"
                value={draft.timeFormat}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    timeFormat: event.target.value as SystemPreferences['timeFormat'],
                  }));
                  setFeedback(null);
                }}
                options={[
                  { value: '12H', label: '12-hour (AM/PM)' },
                  { value: '24H', label: '24-hour' },
                ]}
              />
              <Select
                label="Default Export Format"
                value={draft.defaultExportFormat}
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    defaultExportFormat: event.target.value as SystemPreferences['defaultExportFormat'],
                  }));
                  setFeedback(null);
                }}
                options={[
                  { value: 'PDF', label: 'PDF' },
                  { value: 'CSV', label: 'CSV' },
                ]}
              />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-paper-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            className="w-full sm:w-auto"
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => setIsResetDialogOpen(true)}
          >
            Reset to System Defaults
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
              disabled={!isDirty || isBusy}
              onClick={() => {
                setDraft(savedPreferences);
                setFeedback(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="submit"
              variant="primary"
              isLoading={isSaving}
              disabled={!isDirty || !isValid || isResetting}
            >
              {isSaving ? 'Saving Preferences…' : 'Save System Preferences'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        isOpen={isResetDialogOpen}
        isDismissDisabled={isResetting}
        onClose={() => setIsResetDialogOpen(false)}
        title="Reset System preferences?"
        description="This replaces your saved System preferences with the canonical defaults owned by the server."
        footer={(
          <>
            <Button
              variant="outline"
              disabled={isResetting}
              onClick={() => setIsResetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={isResetting}
              onClick={handleConfirmedReset}
            >
              {isResetting ? 'Resetting Preferences…' : 'Reset Preferences'}
            </Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-ink-secondary">
          Your current draft and saved values will be replaced only after the reset request succeeds.
        </p>
      </Dialog>
    </>
  );
}

export function SystemSettingsTab({
  onDirtyChange,
  onSessionExpired,
}: SystemSettingsTabProps) {
  const {
    preferences,
    academicOptions,
    loadStatus,
    loadError,
    retry,
    adoptPreferences,
  } = useSystemPreferences();

  if (loadStatus === 'loading') {
    return <PageLoad message="Loading System preferences" />;
  }

  if (loadStatus === 'error' || !preferences || !academicOptions) {
    return (
      <Panel
        header="System Preferences Unavailable"
        sectionNumber="01"
        showCrosshairs={false}
        className="bg-paper-light"
      >
        <div className="space-y-5">
          <Notice variant="error" title="Unable to load Settings">
            {loadError ?? 'The System preference response was unavailable.'}
          </Notice>
          <Button variant="outline" onClick={retry}>Retry</Button>
        </div>
      </Panel>
    );
  }

  return (
    <SystemPreferencesForm
      initialPreferences={preferences}
      academicOptions={academicOptions}
      adoptPreferences={adoptPreferences}
      onDirtyChange={onDirtyChange}
      onSessionExpired={onSessionExpired}
    />
  );
}
