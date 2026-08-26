// Owns Classes page loading, dialog state, and active-directory workflow handlers.
import { useEffect, useState } from 'react';
import { ClassApiError, fetchClasses } from './classes-api';
import type { ClassRecord } from './class-types';

type LoadStatus = 'loading' | 'ready' | 'error';
type ClassFormTarget = 'new' | ClassRecord | null;

// Coordinates class loading, add/edit dialogs, archiving, and retry state.
export function useClassWorkspace(onSessionExpired: () => void) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [classFormTarget, setClassFormTarget] = useState<ClassFormTarget>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClassRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchClasses(controller.signal)
      .then((records) => {
        setClasses(records);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (error instanceof ClassApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load the class directory.',
        );
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  // Restarts the directory request after a recoverable load failure.
  const handleRetryLoad = () => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Opens the blank class form.
  const handleOpenCreate = () => {
    setClassFormTarget('new');
  };

  // Opens the class form with one persisted class selected for editing.
  const handleOpenEdit = (classRecord: ClassRecord) => {
    setClassFormTarget(classRecord);
  };

  // Closes the class form without changing the active directory.
  const handleCloseForm = () => {
    setClassFormTarget(null);
  };

  // Opens archive confirmation for one active class.
  const handleOpenArchive = (classRecord: ClassRecord) => {
    setArchiveTarget(classRecord);
  };

  // Closes archive confirmation without changing the active directory.
  const handleCloseArchive = () => {
    setArchiveTarget(null);
  };

  // Updates the active directory with the class returned by a successful save.
  const handleClassSaved = (savedClass: ClassRecord) => {
    setClasses((currentClasses) => {
      const alreadyExists = currentClasses.some(
        (classRecord) => classRecord.id === savedClass.id,
      );

      return alreadyExists
        ? currentClasses.map((classRecord) =>
          classRecord.id === savedClass.id ? savedClass : classRecord,
        )
        : [savedClass, ...currentClasses];
    });
    setClassFormTarget(null);
  };

  // Removes a successfully archived class from the active directory.
  const handleClassArchived = (classId: string) => {
    setClasses((currentClasses) =>
      currentClasses.filter((classRecord) => classRecord.id !== classId),
    );
    setArchiveTarget(null);
  };

  return {
    classes,
    loadStatus,
    loadError,
    classFormTarget,
    archiveTarget,
    handleRetryLoad,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
    handleOpenArchive,
    handleCloseArchive,
    handleClassSaved,
    handleClassArchived,
  };
}
