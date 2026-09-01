// Defines the shared authenticated preference state contract and consuming hook.
import { createContext, useContext } from 'react';
import type { AcademicPreferenceOptions, SystemPreferences } from './settings-types';

export type PreferencesLoadStatus = 'loading' | 'ready' | 'error';

export interface SystemPreferencesContextValue {
  preferences: SystemPreferences | null;
  academicOptions: AcademicPreferenceOptions | null;
  loadStatus: PreferencesLoadStatus;
  loadError: string | null;
  retry: () => void;
  adoptPreferences: (preferences: SystemPreferences) => void;
}

export const SystemPreferencesContext = createContext<SystemPreferencesContextValue | null>(null);

export function useSystemPreferences() {
  const context = useContext(SystemPreferencesContext);
  if (!context) {
    throw new Error('useSystemPreferences must be used inside SystemPreferencesProvider.');
  }

  return context;
}
