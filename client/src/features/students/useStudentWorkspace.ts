// Owns Students page loading, add-dialog state, and saved-directory workflow handlers.
import { useEffect, useState } from 'react';
import { ClassApiError, fetchClasses } from '../classes/classes-api';
import type { ClassRecord } from '../classes/class-types';
import { fetchStudents, StudentApiError } from './students-api';
import type { StudentRecord } from './student-types';

type LoadStatus = 'loading' | 'ready' | 'error';

// Coordinates class/student loading, retries, and persisted student additions.
export function useStudentWorkspace(onSessionExpired: () => void) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchClasses(controller.signal),
      fetchStudents(controller.signal),
    ])
      .then(([classRecords, studentRecords]) => {
        setClasses(classRecords);
        setStudents(studentRecords);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (
          (error instanceof ClassApiError || error instanceof StudentApiError) &&
          error.status === 401
        ) {
          onSessionExpired();
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load the student workspace.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  // Restarts both directory requests after a recoverable load failure.
  const handleRetryLoad = () => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Opens the persisted multi-class student form when active classes are available.
  const handleOpenForm = () => {
    if (loadStatus === 'ready' && classes.length > 0) {
      setIsFormOpen(true);
    }
  };

  // Closes the student form without changing the saved directory.
  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  // Prepends the saved student returned by the server and closes the form.
  const handleStudentSaved = (student: StudentRecord) => {
    setStudents((currentStudents) => [student, ...currentStudents]);
    setIsFormOpen(false);
  };

  return {
    classes,
    students,
    loadStatus,
    loadError,
    isFormOpen,
    canAddStudent: loadStatus === 'ready' && classes.length > 0,
    handleRetryLoad,
    handleOpenForm,
    handleCloseForm,
    handleStudentSaved,
  };
}
