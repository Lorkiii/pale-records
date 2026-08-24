// Composes persisted students, active class choices, and the multi-class add flow.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { ClassApiError, fetchClasses } from '../features/classes/classes-api';
import type { ClassRecord } from '../features/classes/class-types';
import { StudentDirectory } from '../features/students/components/StudentDirectory';
import { StudentFormDialog } from '../features/students/components/StudentFormDialog';
import { fetchStudents, StudentApiError } from '../features/students/students-api';
import type { StudentRecord } from '../features/students/student-types';

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

// Coordinates student/class loading and persisted multi-class additions.
export function StudentPage({ onSessionExpired }: StudentPageProps) {
  const navigate = useNavigate();
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
              Add each student once, assign every class they attend, and review saved identity details.
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
                Loading student workspace…
              </p>
            </div>
          ) : null}

          {loadStatus === 'error' ? (
            <Notice variant="error" title="Student workspace unavailable">
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

          {loadStatus === 'ready' && classes.length === 0 && students.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<StudentIcon />}
                title="No classes available"
                description="Add a class before adding students, because every student needs at least one class."
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
                description="Add the first student and select every class they attend."
                action={<Button onClick={() => setIsFormOpen(true)}>Add student</Button>}
                className="min-h-72"
              />
            </div>
          ) : null}

          {loadStatus === 'ready' && students.length > 0 ? (
            <div className="space-y-8">
              {classes.length === 0 ? (
                <Notice variant="warning" title="No active classes">
                  <div className="space-y-4">
                    <p>Saved students remain available, but a new student cannot be added until an active class exists.</p>
                    <Button size="sm" variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                      Go to classes
                    </Button>
                  </div>
                </Notice>
              ) : null}
              <StudentDirectory students={students} />
            </div>
          ) : null}
        </div>
      </div>

      {isFormOpen ? (
        <StudentFormDialog
          isOpen
          classes={classes}
          onClose={() => setIsFormOpen(false)}
          onSaved={(student) => {
            setStudents((currentStudents) => [student, ...currentStudents]);
            setIsFormOpen(false);
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
