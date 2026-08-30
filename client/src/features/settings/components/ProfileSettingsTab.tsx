// Renders the faculty profile and account credential controls within the Settings view.
import { useState, type FormEvent } from 'react';
import type { AuthenticatedUser } from '../../auth/auth-api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Panel } from '../../../components/ui/Panel';
import {
  getInitialProfileState,
  type PasswordChangeState,
  type ProfileSettingsState,
} from '../settings-types';

interface ProfileSettingsTabProps {
  currentUser: AuthenticatedUser | null;
}

export function ProfileSettingsTab({ currentUser }: ProfileSettingsTabProps) {
  const [profile, setProfile] = useState<ProfileSettingsState>(() =>
    getInitialProfileState(currentUser)
  );

  const [passwordState, setPasswordState] = useState<PasswordChangeState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  // Derives the dynamic display monogram from the current name inputs.
  const initials =
    [profile.firstName, profile.lastName]
      .map((part) => part.trim().charAt(0))
      .filter(Boolean)
      .join('')
      .toUpperCase() || 'FA';

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSavedNotice('Profile information saved in UI preview state.');
    setTimeout(() => setProfileSavedNotice(null), 4000);
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordState.currentPassword) {
      setPasswordNotice({
        variant: 'error',
        message: 'Current password is required to update credentials.',
      });
      return;
    }
    if (!passwordState.newPassword || passwordState.newPassword.length < 8) {
      setPasswordNotice({
        variant: 'error',
        message: 'New password must contain at least 8 characters.',
      });
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setPasswordNotice({
        variant: 'error',
        message: 'New password confirmation does not match.',
      });
      return;
    }

    setPasswordNotice({
      variant: 'success',
      message: 'Password updated successfully (UI Preview mode).',
    });
    setPasswordState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setTimeout(() => setPasswordNotice(null), 4000);
  };

  return (
    <div className="space-y-8">
      {profileSavedNotice && (
        <Notice
          variant="success"
          title="Profile Saved"
          onDismiss={() => setProfileSavedNotice(null)}
        >
          {profileSavedNotice}
        </Notice>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Profile Details Panel */}
        <Panel
          header="Faculty Identity & Records"
          sectionNumber="01"
          showCrosshairs={false}
          className="bg-paper-light"
        >
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Identity Card Header with Monogram Avatar */}
            <div className="flex items-center gap-4 border-b border-paper-border pb-5">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-xl font-bold uppercase tracking-[0.08em] text-paper-light"
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="font-mono text-xs text-ink-muted">
                  {profile.username ? `@${profile.username}` : profile.email}
                </p>
                <span className="mt-1 inline-block border border-paper-dark bg-paper-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                  Faculty Account
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                required
                value={profile.firstName}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
              <Input
                label="Last Name"
                required
                value={profile.lastName}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email Address"
                type="email"
                required
                value={profile.email}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, email: e.target.value }))
                }
                hint="Used for system notifications and class reports"
              />
              <Input
                label="Username"
                value={profile.username}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, username: e.target.value }))
                }
                leftElement="@"
                isMonospace
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary">
                Save Profile Changes
              </Button>
            </div>
          </form>
        </Panel>

        {/* Security & Password Panel */}
        <div className="space-y-6">
          {passwordNotice && (
            <Notice
              variant={passwordNotice.variant}
              title={passwordNotice.variant === 'success' ? 'Password Changed' : 'Error'}
              onDismiss={() => setPasswordNotice(null)}
            >
              {passwordNotice.message}
            </Notice>
          )}

          <Panel
            header="Security & Credentials"
            sectionNumber="02"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <p className="text-xs leading-relaxed text-ink-secondary">
                Update your account password. Passwords should be at least 8 characters long with a mix of letters, numbers, and symbols.
              </p>

              <Input
                label="Current Password"
                type="password"
                required
                allowPasswordToggle
                value={passwordState.currentPassword}
                onChange={(e) =>
                  setPasswordState((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
              />

              <Input
                label="New Password"
                type="password"
                required
                allowPasswordToggle
                value={passwordState.newPassword}
                onChange={(e) =>
                  setPasswordState((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                allowPasswordToggle
                value={passwordState.confirmPassword}
                onChange={(e) =>
                  setPasswordState((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
              />

              <div className="pt-2">
                <Button type="submit" variant="outline" fullWidth>
                  Update Password
                </Button>
              </div>
            </form>
          </Panel>

          <Panel
            header="Active Session"
            sectionNumber="03"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <span className="text-ink-muted uppercase">Authentication</span>
                <span className="font-semibold text-signal-emerald">● Valid Session</span>
              </div>
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <span className="text-ink-muted uppercase">Role</span>
                <span className="font-semibold text-ink">FACULTY / ADMIN</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted uppercase">Environment</span>
                <span className="font-semibold text-ink">PALE Records Client</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
