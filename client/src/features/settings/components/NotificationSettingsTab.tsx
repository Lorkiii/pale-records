// Renders in-app notification toggles, reminder timing, and lecture quiet-mode rules.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Notice } from '../../../components/ui/Notice';
import { Panel } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import {
  INITIAL_NOTIFICATION_SETTINGS,
  type NotificationSettingsState,
} from '../settings-types';

export function NotificationSettingsTab() {
  const [settings, setSettings] = useState<NotificationSettingsState>(
    INITIAL_NOTIFICATION_SETTINGS
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedNotice('In-app notification preferences saved for this session (UI Preview mode).');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleReset = () => {
    setSettings(INITIAL_NOTIFICATION_SETTINGS);
    setSavedNotice('Notification preferences restored to default.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {savedNotice && (
        <Notice
          variant="success"
          title="Notification Settings Saved"
          onDismiss={() => setSavedNotice(null)}
        >
          {savedNotice}
        </Notice>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Agenda & Deadline Reminders */}
        <Panel
          header="Agenda & Academic Deadlines"
          sectionNumber="01"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Control automated reminders for upcoming examinations, student deadlines, and institutional events.
            </p>

            <Checkbox
              label="Examination & Major Deadlines"
              description="Notify before scheduled exams, finals, and assignment due dates"
              checked={settings.agendaUpcomingReminders}
              onChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  agendaUpcomingReminders: checked,
                }))
              }
            />

            {settings.agendaUpcomingReminders && (
              <div className="border-l-2 border-ink pl-4 pt-1">
                <Select
                  label="Advance Notice Window"
                  value={settings.agendaReminderLeadTime}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      agendaReminderLeadTime: e.target.value as '15m' | '30m' | '1h' | '1d',
                    }))
                  }
                  options={[
                    { value: '15m', label: '15 Minutes before scheduled start' },
                    { value: '30m', label: '30 Minutes before scheduled start' },
                    { value: '1h', label: '1 Hour before scheduled start' },
                    { value: '1d', label: '1 Day before scheduled event' },
                  ]}
                  size="sm"
                />
              </div>
            )}

            <div className="border-t border-paper-border pt-4">
              <Checkbox
                label="Faculty Meetings & Assemblies"
                description="Receive reminders for departmental hearings and academic council meetings"
                checked={settings.facultyMeetingAlerts}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    facultyMeetingAlerts: checked,
                  }))
                }
              />
            </div>
          </div>
        </Panel>

        {/* Academic Record Alerts */}
        <Panel
          header="Classroom & Record Keeping Alerts"
          sectionNumber="02"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Keep records up to date by receiving reminders for unfinished classroom workflows.
            </p>

            <Checkbox
              label="Unsubmitted Attendance Reminder"
              description="Alert if a scheduled class session concludes without an attendance submission"
              checked={settings.unrecordedAttendanceAlerts}
              onChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  unrecordedAttendanceAlerts: checked,
                }))
              }
            />

            <div className="border-t border-paper-border pt-4">
              <Checkbox
                label="Unposted Recitation & Activity Scores"
                description="Highlight unfinished drafts in the Activity workspace before term submission deadlines"
                checked={settings.unpostedScoreAlerts}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    unpostedScoreAlerts: checked,
                  }))
                }
              />
            </div>
          </div>
        </Panel>

        {/* Notification Delivery & Quiet Mode */}
        <Panel
          header="In-App Banner & Docket Behavior"
          sectionNumber="03"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Customize how notifications appear on screen during active use.
            </p>

            <Checkbox
              label="Sticky Banner Toasts"
              description="Keep notification toasts on screen until manually dismissed (otherwise auto-dismisses after 5s)"
              checked={settings.stickyBannerToasts}
              onChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  stickyBannerToasts: checked,
                }))
              }
            />

            <div className="border-t border-paper-border pt-4">
              <Checkbox
                label="Sidebar Indicator Badges"
                description="Display numeric indicators on navigation items (e.g. Agenda, Attendance) for pending tasks"
                checked={settings.showSidebarBadgeCounters}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    showSidebarBadgeCounters: checked,
                  }))
                }
              />
            </div>
          </div>
        </Panel>

        {/* Quiet Mode During Class */}
        <Panel
          header="Lecture Quiet Mode"
          sectionNumber="04"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Automatically silence non-critical banners and sound cues when taking roll call or projecting materials.
            </p>

            <Checkbox
              label="Suppress Non-Critical Alerts During Class"
              description="Silences all popups and banners when a class session is actively ongoing"
              checked={settings.quietModeDuringLectures}
              onChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  quietModeDuringLectures: checked,
                }))
              }
            />

            <div className="border-l-2 border-paper-dark bg-paper-muted p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                Status: {settings.quietModeDuringLectures ? 'Quiet Mode Enabled' : 'Standard Delivery'}
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                {settings.quietModeDuringLectures
                  ? 'Notifications will queue quietly in the docket during class hours.'
                  : 'All notifications will appear as standard banner toasts.'}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between border-t border-paper-border pt-4">
        <Button type="button" variant="outline" onClick={handleReset}>
          Reset Notification Defaults
        </Button>
        <Button type="submit" variant="primary">
          Save Notification Preferences
        </Button>
      </div>
    </form>
  );
}
