// Loads authenticated System preferences once and shares server-confirmed values across dashboard pages.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchSettings, SettingsApiError } from './settings-api';
import {
  SystemPreferencesContext,
  type PreferencesLoadStatus,
  type SystemPreferencesContextValue,
} from './system-preferences-store';
import type { AcademicPreferenceOptions, SystemPreferences } from './settings-types';

interface SystemPreferencesProviderProps {
  children: ReactNode;
  onSessionExpired: () => void;
}

export function SystemPreferencesProvider({
  children,
  onSessionExpired,
}: SystemPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<SystemPreferences | null>(null);
  const [academicOptions, setAcademicOptions] = useState<AcademicPreferenceOptions | null>(null);
  const [loadStatus, setLoadStatus] = useState<PreferencesLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchSettings(controller.signal)
      .then((settings) => {
        setPreferences(settings.system);
        setAcademicOptions(settings.academicOptions);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof SettingsApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setPreferences(null);
        setAcademicOptions(null);
        setLoadError(error instanceof SettingsApiError
          ? error.message
          : 'Unable to load System preferences.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [onSessionExpired, requestVersion]);

  const retry = useCallback(() => {
    setPreferences(null);
    setAcademicOptions(null);
    setLoadStatus('loading');
    setLoadError(null);
    setRequestVersion((version) => version + 1);
  }, []);
  const adoptPreferences = useCallback((nextPreferences: SystemPreferences) => {
    setPreferences(nextPreferences);
  }, []);

  const value = useMemo<SystemPreferencesContextValue>(() => ({
    preferences,
    academicOptions,
    loadStatus,
    loadError,
    retry,
    adoptPreferences,
  }), [
    academicOptions,
    loadError,
    loadStatus,
    preferences,
    retry,
    adoptPreferences,
  ]);

  return (
    <SystemPreferencesContext.Provider value={value}>
      {children}
    </SystemPreferencesContext.Provider>
  );
}
