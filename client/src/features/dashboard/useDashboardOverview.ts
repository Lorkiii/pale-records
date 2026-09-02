// Owns Dashboard overview loading, cancellation, session expiry, and retry state.
import { useEffect, useState } from 'react';
import { DashboardApiError, fetchDashboardOverview } from './dashboard-api';
import type { DashboardOverviewData } from './dashboard-types';

export type DashboardLoadStatus = 'loading' | 'ready' | 'error';

// Creates the local calendar date expected by the Dashboard endpoint.
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Loads one stable local-date snapshot and exposes an explicit retry operation.
export function useDashboardOverview(onSessionExpired: () => void) {
  const [asOfDate] = useState(getLocalDateKey);
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [loadStatus, setLoadStatus] = useState<DashboardLoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchDashboardOverview(asOfDate, controller.signal)
      .then((data) => {
        setOverview(data);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof DashboardApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load the Dashboard overview.',
        );
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [asOfDate, loadAttempt, onSessionExpired]);

  // Restarts the request without changing the snapshot date.
  const retry = () => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  return { asOfDate, overview, loadStatus, loadError, retry };
}
