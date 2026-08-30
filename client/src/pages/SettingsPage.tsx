// Composes the Settings workspace page with tabbed views for profile, system, notifications, and agenda categories.
import { useState } from 'react';
import type { AuthenticatedUser } from '../features/auth/auth-api';
import { Header } from '../components/ui/Header';
import { Tabs } from '../components/ui/Tabs';
import { ProfileSettingsTab } from '../features/settings/components/ProfileSettingsTab';
import { SystemSettingsTab } from '../features/settings/components/SystemSettingsTab';
import { NotificationSettingsTab } from '../features/settings/components/NotificationSettingsTab';
import { AgendaCategorySettingsTab } from '../features/settings/components/AgendaCategorySettingsTab';

interface SettingsPageProps {
  currentUser: AuthenticatedUser | null;
}

type SettingsTabId = 'profile' | 'system' | 'notifications' | 'categories';

export function SettingsPage({ currentUser }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');

  const tabItems = [
    { id: 'profile', label: '01 / Profile' },
    { id: 'system', label: '02 / System' },
    { id: 'notifications', label: '03 / Notifications' },
    { id: 'categories', label: '04 / Agenda Categories' },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Settings"
        workspaceDescription="Manage faculty profile, academic system defaults, in-app notifications, and agenda event categories."
      />

      <div className="border-b border-ink bg-paper-light">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 xl:px-12">
          <Tabs
            tabs={tabItems}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as SettingsTabId)}
          />
        </div>
      </div>

      <div className="archival-grid min-h-[calc(100vh-230px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {activeTab === 'profile' && <ProfileSettingsTab currentUser={currentUser} />}
          {activeTab === 'system' && <SystemSettingsTab />}
          {activeTab === 'notifications' && <NotificationSettingsTab />}
          {activeTab === 'categories' && <AgendaCategorySettingsTab />}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
