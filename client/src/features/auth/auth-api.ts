// Owns credentialed client requests to the PALE authentication API.
interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  email: string;
}

// Resolves the truthful display name shared by account UI and generated reports.
export function getAuthenticatedUserDisplayName(user: AuthenticatedUser) {
  const fullName = `${user.firstName.trim()} ${user.lastName.trim()}`.trim();
  return fullName || user.username || user.email;
}

// Narrows untrusted JSON to an object before reading authentication response fields.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Verifies that an untrusted value contains only the expected safe user fields.
function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    (typeof value.username === 'string' || value.username === null) &&
    typeof value.email === 'string'
  );
}

// Reads and validates the authenticated user returned by login or session lookup.
async function readAuthenticatedUser(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error('Unable to read the signed-in account.');
  }

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !isAuthenticatedUser(payload.data.user)
  ) {
    throw new Error('Unable to read the signed-in account.');
  }

  return payload.data.user;
}

// Selects a safe server or client fallback message for a failed login request.
async function readErrorMessage(response: Response) {
  // Fallback messages for the error codes
  const fallbackMessages: Record<number, string> = {
    400: 'Please review the submitted account information.',
    401: 'Invalid email, username, or password.',
    429: 'Too many login attempts. Please try again later.',
  };

  try {
    const payload: unknown = await response.json();

    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Fall back to a safe client message when the response is not JSON.
  }

  return fallbackMessages[response.status] ?? 'Unable to sign in right now. Please try again.';
}

// Submits credentials and returns the validated safe authenticated user.
export async function submitLogin(input: LoginRequest) {
  let response: Response;

  try {
    // Fetch the login endpoint from the server to login the user
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Unable to reach PALE Records. Please check the server and try again.');
  }

  // If the response is not ok, throw an error
  if (!response.ok) {
    // Read the error message from the response
    throw new Error(await readErrorMessage(response));
  }

  return readAuthenticatedUser(response);
}

// Asks the server whether the browser's HTTP-only session cookie is still valid.
export async function checkAuthenticatedSession(signal: AbortSignal) {
  // Fetch the session endpoint from the server to check if the user is authenticated
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
    signal,
  });

  // If the response is 401, the user is not authenticated
  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to verify the current session.');
  }

  return readAuthenticatedUser(response);
}
