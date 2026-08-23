// Presents the current account identity and a data-derived initials avatar in application headers.
import type { AuthenticatedUser } from '../../features/auth/auth-api';

interface UserProfileProps {
  user: AuthenticatedUser;
  accountLabel: string;
}

function getDisplayName(user: AuthenticatedUser) {
  const fullName = `${user.firstName.trim()} ${user.lastName.trim()}`.trim();
  return fullName || user.username || user.email;
}

function getInitials(user: AuthenticatedUser) {
  const initials = [user.firstName, user.lastName]
    .map((name) => name.trim().charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return initials || (user.username ?? user.email).charAt(0).toUpperCase();
}

export function UserProfile({ user, accountLabel }: UserProfileProps) {
  const displayName = getDisplayName(user);
  const accountIdentifier = user.username ? `@${user.username}` : user.email;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="sr-only">Signed in as {displayName}, {accountLabel}</span>
      <div className="hidden min-w-0 text-right sm:block">
        <p className="max-w-52 truncate text-sm font-semibold text-ink">{displayName}</p>
        <p className="mt-0.5 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          <span>{accountLabel}</span>
          <span aria-hidden="true">/</span>
          <span className="max-w-40 truncate normal-case tracking-normal">{accountIdentifier}</span>
        </p>
      </div>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-sm font-bold uppercase tracking-[0.08em] text-paper-light"
        aria-hidden="true"
      >
        {getInitials(user)}
      </div>
    </div>
  );
}
