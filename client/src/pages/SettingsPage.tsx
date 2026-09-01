// Composes persistent Settings tabs while preserving and protecting unsaved account drafts.
import { useEffect, useState } from 'react';
import type { AuthenticatedUser } from '../features/auth/auth-api';
import { Header } from '../components/ui/Header';
import { Tabs, type TabItem } from '../components/ui/Tabs';
import { ProfileSettingsTab } from '../features/settings/components/ProfileSettingsTab';
import { SystemSettingsTab } from '../features/settings/components/SystemSettingsTab';
import { AgendaCategorySettingsTab } from '../features/settings/components/AgendaCategorySettingsTab';

interface SettingsPageProps {
  currentUser: AuthenticatedUser;
  onProfileUpdated: (user: AuthenticatedUser) => void;
  onSessionExpired: () => void;
}

type SettingsTabId = 'profile' | 'system' | 'categories';

const UNSAVED_NAVIGATION_MESSAGE =
  'You have unsaved Profile or System changes. Leave Settings and lose this draft?';
const SETTINGS_TABS: ReadonlyArray<TabItem & { id: SettingsTabId }> = [
  {
    id: 'profile',
    tabId: 'settings-profile-tab',
    panelId: 'settings-profile-panel',
    label: '01 / Profile',
  },
  {
    id: 'system',
    tabId: 'settings-system-tab',
    panelId: 'settings-system-panel',
    label: '02 / System',
  },
  {
    id: 'categories',
    tabId: 'settings-categories-tab',
    panelId: 'settings-categories-panel',
    label: '03 / Agenda Categories',
  },
];

export function SettingsPage({
  currentUser,
  onProfileUpdated,
  onSessionExpired,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [isSystemDirty, setIsSystemDirty] = useState(false);
  const hasUnsavedChanges = isProfileDirty || isSystemDirty;

  // Tab changes retain mounted drafts; only exits that discard them require confirmation.
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const handleInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname
      ) {
        return;
      }

      if (!window.confirm(UNSAVED_NAVIGATION_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleInternalNavigation, true);
    };
  }, [hasUnsavedChanges]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Settings"
        workspaceDescription="Manage your authenticated profile, per-user System defaults, and Agenda categories."
      />

      <div className="border-b border-ink bg-paper-light">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 xl:px-12">
          <Tabs
            tabs={SETTINGS_TABS}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
            ariaLabel="Settings sections"
          />
        </div>
      </div>

      <div className="archival-grid min-h-[calc(100vh-230px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <section
            id="settings-profile-panel"
            role="tabpanel"
            aria-labelledby="settings-profile-tab"
            hidden={activeTab !== 'profile'}
          >
            <ProfileSettingsTab
              currentUser={currentUser}
              onProfileUpdated={onProfileUpdated}
              onSessionExpired={onSessionExpired}
              onDirtyChange={setIsProfileDirty}
            />
          </section>
          <section
            id="settings-system-panel"
            role="tabpanel"
            aria-labelledby="settings-system-tab"
            hidden={activeTab !== 'system'}
          >
            <SystemSettingsTab
              onDirtyChange={setIsSystemDirty}
              onSessionExpired={onSessionExpired}
            />
          </section>
          <section
            id="settings-categories-panel"
            role="tabpanel"
            aria-labelledby="settings-categories-tab"
            hidden={activeTab !== 'categories'}
          >
            <AgendaCategorySettingsTab onSessionExpired={onSessionExpired} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
