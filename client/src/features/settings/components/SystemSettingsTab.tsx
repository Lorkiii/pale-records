// Renders academic term defaults, attendance rules, and display preferences.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { Panel } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import {
  INITIAL_SYSTEM_SETTINGS,
  type SystemSettingsState,
} from '../settings-types';

export function SystemSettingsTab() {
  const [settings, setSettings] = useState<SystemSettingsState>(INITIAL_SYSTEM_SETTINGS);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedNotice('System preferences saved for this session (UI Preview mode).');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleReset = () => {
    setSettings(INITIAL_SYSTEM_SETTINGS);
    setSavedNotice('System defaults restored.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {savedNotice && (
        <Notice
          variant="success"
          title="System Preferences Saved"
          onDismiss={() => setSavedNotice(null)}
        >
          {savedNotice}
        </Notice>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Academic Term & Defaults */}
        <Panel
          header="Academic Term & Context"
          sectionNumber="01"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Configure the primary academic year and term pre-selected across Class records, Attendance rosters, and Activity calculations.
            </p>

            <Select
              label="Default Academic Year"
              value={settings.defaultAcademicYear}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, defaultAcademicYear: e.target.value }))
              }
              options={[
                { value: '2025-2026', label: 'Academic Year 2025–2026 (Current)' },
                { value: '2024-2025', label: 'Academic Year 2024–2025' },
                { value: '2026-2027', label: 'Academic Year 2026–2027 (Upcoming)' },
              ]}
              hint="Initial filter selection on all class record directories"
            />

            <Select
              label="Default Semester / Term"
              value={settings.defaultTerm}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, defaultTerm: e.target.value }))
              }
              options={[
                { value: '1ST_SEM', label: '1st Semester / First Half' },
                { value: '2ND_SEM', label: '2nd Semester / Second Half' },
                { value: 'SUMMER', label: 'Summer / Midyear Term' },
              ]}
            />
          </div>
        </Panel>

        {/* Attendance & Session Rules */}
        <Panel
          header="Attendance & Roll Call Rules"
          sectionNumber="02"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Set grace periods and default status presets when taking live class attendance.
            </p>

            <Select
              label="Tardy Grace Period"
              value={settings.attendanceGracePeriod}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, attendanceGracePeriod: e.target.value }))
              }
              options={[
                { value: '10', label: '10 Minutes after class start' },
                { value: '15', label: '15 Minutes after class start (Standard)' },
                { value: '20', label: '20 Minutes after class start' },
                { value: '30', label: '30 Minutes after class start' },
              ]}
              hint="Students arriving after this window are automatically tagged as Late"
            />

            <Select
              label="New Roll Call Default State"
              value={settings.defaultAttendanceStatus}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultAttendanceStatus: e.target.value as 'PRESENT' | 'UNRECORDED',
                }))
              }
              options={[
                { value: 'PRESENT', label: 'Default all students to Present (Exception-based entry)' },
                { value: 'UNRECORDED', label: 'Default all students to Unrecorded (Explicit check-in)' },
              ]}
            />
          </div>
        </Panel>

        {/* Display & Export Ergonomics */}
        <Panel
          header="Display & Export Ergonomics"
          sectionNumber="03"
          showCrosshairs={false}
          className="bg-paper-light lg:col-span-2"
        >
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink-secondary">
              Customize density, date formats, and default document export formats for administrative printing.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Roster Table Density"
                value={settings.tableDensity}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    tableDensity: e.target.value as 'COMFORTABLE' | 'COMPACT',
                  }))
                }
                options={[
                  { value: 'COMFORTABLE', label: 'Comfortable' },
                  { value: 'COMPACT', label: 'Compact' },
                ]}
              />

              <Select
                label="Date Stamp Format"
                value={settings.dateFormat}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    dateFormat: e.target.value as 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY',
                  }))
                }
                options={[
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                ]}
              />

              <Select
                label="Clock Format"
                value={settings.timeFormat}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    timeFormat: e.target.value as '12H' | '24H',
                  }))
                }
                options={[
                  { value: '12H', label: '12-Hour (AM/PM)' },
                  { value: '24H', label: '24-Hour (24h)' },
                ]}
              />

              <Select
                label="Default Export Output"
                value={settings.defaultExportFormat}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultExportFormat: e.target.value as 'CSV' | 'PDF',
                  }))
                }
                options={[
                  { value: 'PDF', label: 'Print-ready PDF' },
                  { value: 'CSV', label: 'CSV Spreadsheet' },
                ]}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between border-t border-paper-border pt-4">
        <Button type="button" variant="outline" onClick={handleReset}>
          Reset to System Defaults
        </Button>
        <Button type="submit" variant="primary">
          Save System Preferences
        </Button>
      </div>
    </form>
  );
}
