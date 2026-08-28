// Owns session-aware routing between the PALE login and dashboard screens.
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardShell } from './components/layout/DashboardShell';
import {
  checkAuthenticatedSession,
  type AuthenticatedUser,
} from './features/auth/auth-api';
import { ActivityPage } from './pages/ActivityPage';
import { AttendancePage } from './pages/AttendancePage';
import { ClassPage } from './pages/ClassPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmptyWorkspacePage } from './pages/EmptyWorkspacePage';
import { LoginPage } from './pages/LoginPage';
import { StudentPage } from './pages/StudentPage';
import SessionLoadingScreen from './components/ui/SessionLoading';

type AuthenticationStatus = 'checking' | 'authenticated' | 'unauthenticated';

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
        <Route
          path="attendance"
          element={
            <AttendancePage
              currentUser={authenticatedUser!}
              onSessionExpired={handleSessionExpired}
            />
          }
        />
        <Route
          path="activity"
          element={<ActivityPage onSessionExpired={handleSessionExpired} />}
        />
        <Route path="agenda" element={<EmptyWorkspacePage section="agenda" />} />
      </Route>
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
}
