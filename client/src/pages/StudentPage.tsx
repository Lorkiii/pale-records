// Composes active class choices, page-local student records, and the add-student dialog.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { ClassApiError, fetchClasses } from '../features/classes/classes-api';
import type { ClassRecord } from '../features/classes/class-types';
import { StudentDirectory } from '../features/students/components/StudentDirectory';
import { StudentFormDialog } from '../features/students/components/StudentFormDialog';
import type { StudentInput, StudentRecord } from '../features/students/student-types';

interface StudentPageProps {
  onSessionExpired: () => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

// Provides the student symbol used by student directory empty states.
function StudentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.7-4.5 3.4-7 8-7s7.3 2.5 8 7" />
    </svg>
  );
}

// Coordinates class loading and student additions without implying backend persistence.
export function StudentPage({ onSessionExpired }: StudentPageProps) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const nextStudentId = useRef(1);

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

        setLoadError(error instanceof Error ? error.message : 'Unable to load the available classes.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  // Creates a rendering-only identifier and keeps the new student in page memory.
  const addStudent = (student: StudentInput) => {
    const clientId = `student-${nextStudentId.current}`;
    nextStudentId.current += 1;
    setStudents((currentStudents) => [
      { ...student, clientId },
      ...currentStudents,
    ]);
    setIsFormOpen(false);
  };

  const canAddStudent = loadStatus === 'ready' && classes.length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-5 py-8 sm:px-8 sm:py-10 md:flex-row md:items-end xl:px-12">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Workspace / Students
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
              Students
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
              Add students to active classes and review their recorded identity details.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Student entries remain on this page only and are not saved yet.
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} disabled={!canAddStudent}>
            Add student
          </Button>
        </div>
      </header>

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {loadStatus === 'loading' ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Loading class options…
              </p>
            </div>
          ) : null}

          {loadStatus === 'error' ? (
            <Notice variant="error" title="Class options unavailable">
              <div className="space-y-4">
                <p>{loadError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLoadStatus('loading');
                    setLoadError('');
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {loadStatus === 'ready' && classes.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<StudentIcon />}
                title="No classes available"
                description="Add a class before adding students, because every student record must belong to a class."
                action={
                  <Button variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                    Go to classes
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {loadStatus === 'ready' && classes.length > 0 && students.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<StudentIcon />}
                title="No students added"
                description="Add the first student and assign the record to one of the available classes."
                action={<Button onClick={() => setIsFormOpen(true)}>Add student</Button>}
                className="min-h-72"
              />
            </div>
          ) : null}

          {loadStatus === 'ready' && students.length > 0 ? (
            <StudentDirectory students={students} classes={classes} />
          ) : null}
        </div>
      </div>

      {isFormOpen ? (
        <StudentFormDialog
          isOpen
          classes={classes}
          onClose={() => setIsFormOpen(false)}
          onAdd={addStudent}
        />
      ) : null}
    </div>
  );
}
