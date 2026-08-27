// Owns Students loading, dialog state, and active-directory workflow handlers.
import { useEffect, useState } from 'react';
import { ClassApiError, fetchClasses } from '../classes/classes-api';
import type { ClassRecord } from '../classes/class-types';
import { fetchStudents, StudentApiError } from './students-api';
import type { StudentRecord } from './student-types';

type LoadStatus = 'loading' | 'ready' | 'error';
type StudentFormTarget = 'new' | StudentRecord | null;

// Coordinates class/student loading, retries, and persisted student additions.
export function useStudentWorkspace(onSessionExpired: () => void) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [studentFormTarget, setStudentFormTarget] = useState<StudentFormTarget>(null);
  const [archiveTarget, setArchiveTarget] = useState<StudentRecord | null>(null);

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
      setStudentFormTarget('new');
    }
  };

  // Opens the student form with one persisted active student selected for editing.
  const handleOpenEdit = (student: StudentRecord) => {
    if (classes.length > 0) {
      setStudentFormTarget(student);
    }
  };

  // Closes the student form without changing the saved directory.
  const handleCloseForm = () => {
    setStudentFormTarget(null);
  };

  // Opens or closes archive confirmation without changing the active directory.
  const handleOpenArchive = (student: StudentRecord) => {
    setArchiveTarget(student);
  };

  const handleCloseArchive = () => {
    setArchiveTarget(null);
  };

  // Inserts or replaces the student returned by the server and closes the form.
  const handleStudentSaved = (student: StudentRecord) => {
    setStudents((currentStudents) => {
      const alreadyExists = currentStudents.some(
        (currentStudent) => currentStudent.id === student.id,
      );

      return alreadyExists
        ? currentStudents.map((currentStudent) =>
          currentStudent.id === student.id ? student : currentStudent,
        )
        : [student, ...currentStudents];
    });
    setStudentFormTarget(null);
  };

  // Removes a successfully archived student from the active directory.
  const handleStudentArchived = (studentId: string) => {
    setStudents((currentStudents) =>
      currentStudents.filter((student) => student.id !== studentId),
    );
    setArchiveTarget(null);
  };

  return {
    classes,
    students,
    loadStatus,
    loadError,
    studentFormTarget,
    archiveTarget,
    canAddStudent: loadStatus === 'ready' && classes.length > 0,
    handleRetryLoad,
    handleOpenForm,
    handleOpenEdit,
    handleCloseForm,
    handleOpenArchive,
    handleCloseArchive,
    handleStudentSaved,
    handleStudentArchived,
  };
}
