// Composes the active class directory, add/edit forms, archive confirmation, and request states.
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { ArchiveClassDialog } from '../features/classes/components/ArchiveClassDialog';
import { ClassFormDialog } from '../features/classes/components/ClassFormDialog';
import { ClassDirectory } from '../features/classes/components/ClassDirectory';
import { ClassApiError, fetchClasses } from '../features/classes/classes-api';
import type { ClassRecord } from '../features/classes/class-types';

interface ClassPageProps {
  onSessionExpired: () => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';
type ClassFormTarget = 'new' | ClassRecord | null;

// Provides the decorative class symbol used by the empty directory state.
function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m3 6 9-3 9 3-9 3-9-3Z" />
      <path d="M7 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8M21 7v6" />
    </svg>
  );
}

// Coordinates class loading, add/edit dialogs, archiving, and page-level request states.
export function ClassPage({ onSessionExpired }: ClassPageProps) {
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

        setLoadError(error instanceof Error ? error.message : 'Unable to load the class directory.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

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
    setClasses((currentClasses) => currentClasses.filter(
      (classRecord) => classRecord.id !== classId,
    ));
    setArchiveTarget(null);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-5 py-8 sm:px-8 sm:py-10 md:flex-row md:items-end xl:px-12">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Workspace / Class
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
              Class
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
              Organize subjects, sections, academic terms, teachers, rooms, and class dates.
            </p>
          </div>
          <Button
            onClick={() => setClassFormTarget('new')}
            disabled={loadStatus !== 'ready'}
          >
            Add class
          </Button>
        </div>
      </header>

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {loadStatus === 'loading' ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Loading class directory…
              </p>
            </div>
          ) : null}

          {loadStatus === 'error' ? (
            <Notice variant="error" title="Class directory unavailable">
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
                icon={<ClassIcon />}
                title="No classes available"
                description="Add the first class to begin organizing its subject and academic details."
                action={<Button onClick={() => setClassFormTarget('new')}>Add class</Button>}
                className="min-h-72"
              />
            </div>
          ) : null}

          {loadStatus === 'ready' && classes.length > 0 ? (
            <ClassDirectory
              classes={classes}
              onEdit={setClassFormTarget}
              onArchive={setArchiveTarget}
            />
          ) : null}
        </div>
      </div>

      {classFormTarget ? (
        <ClassFormDialog
          key={classFormTarget === 'new' ? 'new' : classFormTarget.id}
          isOpen
          classRecord={classFormTarget === 'new' ? undefined : classFormTarget}
          onClose={() => setClassFormTarget(null)}
          onSaved={handleClassSaved}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {archiveTarget ? (
        <ArchiveClassDialog
          key={archiveTarget.id}
          classRecord={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchived={handleClassArchived}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
