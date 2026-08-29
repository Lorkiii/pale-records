// Owns explicit legacy detection, sequential retry-safe import, progress, and cleanup state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AgendaApiError, importLegacyAgendaEvent } from './agenda-api';
import {
  clearLegacyAgendaEvents,
  readLegacyAgendaEvents,
  type LegacyAgendaReadResult,
} from './agenda-legacy-storage';

export interface AgendaLegacyImportNotice {
  variant: 'success' | 'warning';
  title: string;
  message: string;
}

interface UseAgendaLegacyImportOptions {
  isAgendaReady: boolean;
  onImportComplete: () => void;
  onSessionExpired: () => void;
}

// Produces an honest warning for invalid or inaccessible browser-local data.
function getLegacyStorageWarning(result: LegacyAgendaReadResult | null) {
  if (!result) return null;

  if (result.status === 'unavailable') {
    return 'PALE could not access this browser profile\'s legacy Agenda storage. No local data was changed.';
  }

  if (result.status !== 'invalid') return null;

  if (result.reason === 'too_many' && result.detectedCount !== null) {
    return `Found ${result.detectedCount} local Agenda entries, exceeding the safe 200-event import limit. No import was started and the browser data remains untouched.`;
  }

  if (result.invalidCount !== null && result.detectedCount !== null) {
    return `${result.invalidCount} of ${result.detectedCount} local Agenda entries could not be validated safely. No import was started and the browser data remains untouched.`;
  }

  return 'The browser-local Agenda data could not be validated safely. No import was started and the local data remains untouched.';
}

export function useAgendaLegacyImport({
  isAgendaReady,
  onImportComplete,
  onSessionExpired,
}: UseAgendaLegacyImportOptions) {
  const [readResult, setReadResult] = useState<LegacyAgendaReadResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [alreadyImportedCount, setAlreadyImportedCount] = useState(0);
  const [removedClassAssociationCount, setRemovedClassAssociationCount] = useState(0);
  const [currentRequestError, setCurrentRequestError] = useState('');
  const [pageNotice, setPageNotice] = useState<AgendaLegacyImportNotice | null>(null);
  const hasAttemptedRead = useRef(false);
  const importInFlight = useRef(false);
  const wasDismissed = useRef(false);

  // Reads once after the authoritative Agenda range is usable and never assigns ownership automatically.
  useEffect(() => {
    if (!isAgendaReady || hasAttemptedRead.current) return undefined;
    let isCurrent = true;

    Promise.resolve().then(() => {
      if (!isCurrent || hasAttemptedRead.current) return;
      hasAttemptedRead.current = true;
      const result = readLegacyAgendaEvents();
      setReadResult(result);
      if (result.status === 'ready' && !wasDismissed.current) {
        setIsDialogOpen(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [isAgendaReady]);

  // Keeps Not now as an in-memory dismissal without changing the legacy key.
  const dismissImport = useCallback(() => {
    if (isImporting) return;
    wasDismissed.current = true;
    setIsDialogOpen(false);
    setCurrentRequestError('');
  }, [isImporting]);

  // Replays the complete collection sequentially; server idempotency acknowledges prior successes.
  const importEvents = useCallback(async () => {
    if (importInFlight.current || readResult?.status !== 'ready') return;

    importInFlight.current = true;
    setIsImporting(true);
    setCurrentRequestError('');
    setPageNotice(null);
    setCurrentIndex(0);
    setImportedCount(0);
    setAlreadyImportedCount(0);
    setRemovedClassAssociationCount(0);

    let nextImportedCount = 0;
    let nextAlreadyImportedCount = 0;
    let nextRemovedClassCount = 0;

    try {
      for (let index = 0; index < readResult.events.length; index += 1) {
        setCurrentIndex(index + 1);
        const acknowledgement = await importLegacyAgendaEvent(readResult.events[index]);

        if (acknowledgement.imported) {
          nextImportedCount += 1;
        } else {
          nextAlreadyImportedCount += 1;
        }
        if (acknowledgement.classAssociationRemoved) {
          nextRemovedClassCount += 1;
        }

        setImportedCount(nextImportedCount);
        setAlreadyImportedCount(nextAlreadyImportedCount);
        setRemovedClassAssociationCount(nextRemovedClassCount);
      }

      if (!clearLegacyAgendaEvents()) {
        const cleanupMessage = 'Every event was acknowledged by the database, but the browser-local copy could not be cleared. Retrying the complete import is safe and will not duplicate acknowledged events.';
        setCurrentRequestError(cleanupMessage);
        setPageNotice({
          variant: 'warning',
          title: 'Agenda imported; browser cleanup incomplete',
          message: cleanupMessage,
        });
        return;
      }

      setReadResult({ status: 'no_data' });
      setIsDialogOpen(false);
      setPageNotice({
        variant: 'success',
        title: 'Legacy Agenda import complete',
        message: `${nextImportedCount} imported, ${nextAlreadyImportedCount} already acknowledged, and ${nextRemovedClassCount} missing Class associations cleared. The browser-local source was removed.`,
      });
      onImportComplete();
    } catch (error: unknown) {
      if (error instanceof AgendaApiError && error.status === 401) {
        onSessionExpired();
      }

      const acknowledgedCount = nextImportedCount + nextAlreadyImportedCount;
      const safeMessage = error instanceof Error
        ? error.message
        : 'The legacy Agenda import could not continue.';
      setCurrentRequestError(
        `${safeMessage} ${acknowledgedCount} of ${readResult.events.length} events were acknowledged. The browser-local source remains untouched, and retrying the complete import is safe.`,
      );
    } finally {
      importInFlight.current = false;
      setIsImporting(false);
    }
  }, [onImportComplete, onSessionExpired, readResult]);

  const events = readResult?.status === 'ready' ? readResult.events : [];

  return {
    eventCount: events.length,
    isDialogOpen,
    isImporting,
    currentIndex,
    importedCount,
    alreadyImportedCount,
    removedClassAssociationCount,
    currentRequestError,
    legacyStorageWarning: getLegacyStorageWarning(readResult),
    pageNotice,
    dismissImport,
    importEvents,
    dismissPageNotice: () => setPageNotice(null),
  };
}
