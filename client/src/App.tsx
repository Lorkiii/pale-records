// Owns session-aware routing between the PALE login and dashboard screens.
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardShell } from './components/layout/DashboardShell';
import {
  checkAuthenticatedSession,
  type AuthenticatedUser,
} from './features/auth/auth-api';
import { DashboardPage } from './pages/DashboardPage';
import { ClassPage } from './pages/ClassPage';
import { EmptyWorkspacePage } from './pages/EmptyWorkspacePage';
import { LoginPage } from './pages/LoginPage';
import { StudentPage } from './pages/StudentPage';

type AuthenticationStatus = 'checking' | 'authenticated' | 'unauthenticated';

// Keeps protected content hidden while the server validates the existing session cookie.
function SessionLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        Checking session…
      </p>
    </main>
  );
}

// Resolves authentication once and routes users through the protected dashboard workspace.
export default function App() {
  const [authenticationStatus, setAuthenticationStatus] = useState<AuthenticationStatus>('checking');
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    checkAuthenticatedSession(controller.signal)
      .then((user) => {
        setAuthenticatedUser(user);
        setAuthenticationStatus(user ? 'authenticated' : 'unauthenticated');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setAuthenticationStatus('unauthenticated');
      });

    return () => controller.abort();
  }, []);

  // Clears client identity when a protected request reports that the session has expired.
  const handleSessionExpired = useCallback(() => {
    setAuthenticatedUser(null);
    setAuthenticationStatus('unauthenticated');
  }, []);

  if (authenticationStatus === 'checking') {
    return <SessionLoadingScreen />;
  }

  const isAuthenticated = authenticationStatus === 'authenticated' && authenticatedUser !== null;
  const defaultPath = isAuthenticated ? '/dashboard' : '/login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultPath} replace />} />
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage
              onAuthenticated={(user) => {
                setAuthenticatedUser(user);
                setAuthenticationStatus('authenticated');
              }}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <DashboardShell currentUser={authenticatedUser} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="classes" element={<ClassPage onSessionExpired={handleSessionExpired} />} />
        <Route path="students" element={<StudentPage onSessionExpired={handleSessionExpired} />} />
        <Route path="attendance" element={<EmptyWorkspacePage section="attendance" />} />
        <Route path="activity" element={<EmptyWorkspacePage section="activity" />} />
        <Route path="agenda" element={<EmptyWorkspacePage section="agenda" />} />
      </Route>
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
}
