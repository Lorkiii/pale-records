// Renders authenticated Profile persistence, dirty-state reporting, and confirmed password changes.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthenticatedUser } from '../../auth/auth-api';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Panel } from '../../../components/ui/Panel';
import { changePassword, SettingsApiError, updateProfile } from '../settings-api';
import { getInitialProfileState, type PasswordChangeState, type ProfileSettingsState } from '../settings-types';

interface ProfileSettingsTabProps {
  currentUser: AuthenticatedUser;
  onProfileUpdated: (user: AuthenticatedUser) => void;
  onSessionExpired: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}

type ProfileFieldErrors = Partial<Record<keyof ProfileSettingsState, string>>;
type PasswordFieldErrors = Partial<Record<keyof PasswordChangeState, string>>;

type ProfileFeedback = {
  variant: 'success' | 'error';
  title: string;
  message: string;
};

const EMPTY_PASSWORD_STATE: PasswordChangeState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function isSameProfile(left: ProfileSettingsState, right: ProfileSettingsState) {
  return left.firstName === right.firstName && left.lastName === right.lastName &&
    left.email === right.email && left.username === right.username;
}

export function ProfileSettingsTab({
  currentUser,
  onProfileUpdated,
  onSessionExpired,
  onDirtyChange,
}: ProfileSettingsTabProps) {
  const navigate = useNavigate();
  const [savedProfile, setSavedProfile] = useState<ProfileSettingsState>(() => getInitialProfileState(currentUser));
  const [profile, setProfile] = useState<ProfileSettingsState>(() => getInitialProfileState(currentUser));
  const [profileErrors, setProfileErrors] = useState<ProfileFieldErrors>({});
  const [profileFeedback, setProfileFeedback] = useState<ProfileFeedback | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwordState, setPasswordState] = useState<PasswordChangeState>(EMPTY_PASSWORD_STATE);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [isPasswordWarningOpen, setIsPasswordWarningOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const focusProfileErrors = (errors: ProfileFieldErrors) => {
    const firstInvalidField = (['firstName', 'lastName', 'email', 'username'] as const)
      .find((field) => errors[field]);
    const fieldRefs = {
      firstName: firstNameRef,
      lastName: lastNameRef,
      email: emailRef,
      username: usernameRef,
    };
    if (firstInvalidField) {
      window.requestAnimationFrame(() => fieldRefs[firstInvalidField].current?.focus());
    }
  };

  const focusPasswordErrors = (errors: PasswordFieldErrors) => {
    const firstInvalidField = (['currentPassword', 'newPassword', 'confirmPassword'] as const)
      .find((field) => errors[field]);
    const fieldRefs = {
      currentPassword: currentPasswordRef,
      newPassword: newPasswordRef,
      confirmPassword: confirmPasswordRef,
    };
    if (firstInvalidField) {
      window.requestAnimationFrame(() => fieldRefs[firstInvalidField].current?.focus());
    }
  };

  const isProfileDirty = !isSameProfile(profile, savedProfile);
  const isPasswordDirty = Object.values(passwordState).some((value) => value.length > 0);
  const isDirty = isProfileDirty || isPasswordDirty;
  const initials = [profile.firstName, profile.lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase() || (profile.username || profile.email).charAt(0).toUpperCase();

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const updateProfileField = (field: keyof ProfileSettingsState, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileErrors((current) => ({ ...current, [field]: undefined }));
    setProfileFeedback(null);
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isProfileDirty || isSavingProfile) return;
    setIsSavingProfile(true);
    setProfileErrors({});
    setProfileFeedback(null);
    try {
      const user = await updateProfile(profile);
      const saved = getInitialProfileState(user);
      setSavedProfile(saved);
      setProfile(saved);
      onProfileUpdated(user);
      setProfileFeedback({
        variant: 'success',
        title: 'Profile Saved',
        message: 'Your Profile changes were saved.',
      });
    } catch (error) {
      if (error instanceof SettingsApiError) {
        if (error.status === 401) onSessionExpired();
        const nextErrors: ProfileFieldErrors = {
          firstName: error.fieldErrors.firstName,
          lastName: error.fieldErrors.lastName,
          email: error.fieldErrors.email,
          username: error.fieldErrors.username,
        };
        setProfileErrors(nextErrors);
        focusProfileErrors(nextErrors);
        setProfileFeedback({
          variant: 'error',
          title: 'Profile Not Saved',
          message: error.message,
        });
      } else {
        setProfileFeedback({
          variant: 'error',
          title: 'Profile Not Saved',
          message: 'Unable to save your Profile right now.',
        });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordNotice(null);
    const nextErrors: PasswordFieldErrors = {};
    if (!passwordState.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.';
    } else if (passwordState.currentPassword.length > 128) {
      nextErrors.currentPassword = 'Current password must be at most 128 characters.';
    }
    if (passwordState.newPassword.length < 8 || passwordState.newPassword.length > 128) {
      nextErrors.newPassword = 'New password must be 8 to 128 characters.';
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      nextErrors.confirmPassword = 'New password confirmation does not match.';
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPasswordNotice('Review the highlighted password fields.');
      focusPasswordErrors(nextErrors);
      return;
    }
    setIsPasswordWarningOpen(true);
  };

  const updatePasswordField = (field: keyof PasswordChangeState, value: string) => {
    setPasswordState((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
    setPasswordNotice(null);
  };

  const handleConfirmedPasswordChange = async () => {
    if (isChangingPassword) return;
    setIsChangingPassword(true);
    setPasswordNotice(null);
    try {
      await changePassword({ currentPassword: passwordState.currentPassword, newPassword: passwordState.newPassword });
      setPasswordState(EMPTY_PASSWORD_STATE);
      setPasswordErrors({});
      onSessionExpired();
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      setIsPasswordWarningOpen(false);
      if (error instanceof SettingsApiError) {
        if (error.status === 401) onSessionExpired();
        const nextErrors: PasswordFieldErrors = {
          currentPassword: error.fieldErrors.currentPassword,
          newPassword: error.fieldErrors.newPassword,
        };
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          nextErrors.currentPassword = error.message;
        }
        setPasswordErrors(nextErrors);
        focusPasswordErrors(nextErrors);
        setPasswordNotice(error.message);
      } else {
        setPasswordNotice('Unable to change your password right now.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {profileFeedback ? (
        <Notice
          variant={profileFeedback.variant}
          title={profileFeedback.title}
          onDismiss={() => setProfileFeedback(null)}
        >
          {profileFeedback.message}
        </Notice>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel header="Profile & Records" sectionNumber="01" showCrosshairs={false} className="bg-paper-light">
          <form onSubmit={handleProfileSubmit} className="space-y-6" noValidate aria-busy={isSavingProfile || undefined}>
            <div className="flex items-center gap-4 border-b border-paper-border pb-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-xl font-bold uppercase tracking-[0.08em] text-paper-light" aria-hidden="true">{initials}</div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink">{profile.firstName} {profile.lastName}</p>
                <p className="font-mono text-xs text-ink-muted">{profile.username ? `@${profile.username}` : profile.email}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input ref={firstNameRef} id="profile-first-name" label="First Name" required value={profile.firstName} error={profileErrors.firstName} disabled={isSavingProfile} maxLength={80} autoComplete="given-name" onChange={(event) => updateProfileField('firstName', event.target.value)} />
              <Input ref={lastNameRef} id="profile-last-name" label="Last Name" required value={profile.lastName} error={profileErrors.lastName} disabled={isSavingProfile} maxLength={80} autoComplete="family-name" onChange={(event) => updateProfileField('lastName', event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input ref={emailRef} id="profile-email" label="Email Address" type="email" required value={profile.email} error={profileErrors.email} disabled={isSavingProfile} maxLength={254} autoComplete="email" onChange={(event) => updateProfileField('email', event.target.value)} />
              <Input ref={usernameRef} id="profile-username" label="Username" value={profile.username} error={profileErrors.username} disabled={isSavingProfile} maxLength={32} leftElement="@" isMonospace autoComplete="username" autoCapitalize="none" spellCheck={false} onChange={(event) => updateProfileField('username', event.target.value)} hint="Optional. Use 3–32 letters, numbers, dots, underscores, or hyphens." />
            </div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" type="button" variant="outline" disabled={!isProfileDirty || isSavingProfile} onClick={() => { setProfile(savedProfile); setProfileErrors({}); setProfileFeedback(null); }}>Cancel</Button>
              <Button className="w-full sm:w-auto" type="submit" variant="primary" isLoading={isSavingProfile} disabled={!isProfileDirty}>{isSavingProfile ? 'Saving Profile…' : 'Save Profile Changes'}</Button>
            </div>
          </form>
        </Panel>
        <div className="space-y-6">
          {passwordNotice ? <Notice variant="error" title="Password not changed" onDismiss={() => setPasswordNotice(null)}>{passwordNotice}</Notice> : null}
          <Panel header="Security & Credentials" sectionNumber="02" showCrosshairs={false} className="bg-paper-light">
            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              <p className="text-xs leading-relaxed text-ink-secondary">Update your account password. New passwords must be 8 to 128 characters.</p>
              <Input ref={currentPasswordRef} id="current-password" label="Current Password" type="password" required allowPasswordToggle autoComplete="current-password" maxLength={128} value={passwordState.currentPassword} error={passwordErrors.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} />
              <Input ref={newPasswordRef} id="new-password" label="New Password" type="password" required allowPasswordToggle autoComplete="new-password" minLength={8} maxLength={128} value={passwordState.newPassword} error={passwordErrors.newPassword} hint="Use 8 to 128 characters." onChange={(event) => updatePasswordField('newPassword', event.target.value)} />
              <Input ref={confirmPasswordRef} id="confirm-new-password" label="Confirm New Password" type="password" required allowPasswordToggle autoComplete="new-password" minLength={8} maxLength={128} value={passwordState.confirmPassword} error={passwordErrors.confirmPassword} onChange={(event) => updatePasswordField('confirmPassword', event.target.value)} />
              <div className="pt-2"><Button type="submit" variant="outline" fullWidth disabled={!isPasswordDirty}>Update Password</Button></div>
            </form>
          </Panel>
        </div>
      </div>
      <Dialog isOpen={isPasswordWarningOpen} isDismissDisabled={isChangingPassword} onClose={() => setIsPasswordWarningOpen(false)} title="Change password?" description="Changing your password invalidates every active session on every device. You will need to sign in again." footer={<><Button variant="outline" disabled={isChangingPassword} onClick={() => setIsPasswordWarningOpen(false)}>Cancel</Button><Button variant="destructive" isLoading={isChangingPassword} onClick={handleConfirmedPasswordChange}>{isChangingPassword ? 'Changing Password…' : 'Change Password and Sign Out'}</Button></>}>
        <p className="text-sm leading-6 text-ink-secondary">Confirm only if you are ready to end your current session and require a new sign-in everywhere.</p>
      </Dialog>
    </div>
  );
}
