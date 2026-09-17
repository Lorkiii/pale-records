// Renders accessible current-page selection and paging controls for archived directories.
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';

interface ArchiveSelectionToolbarProps {
  eligibleCount: number;
  selectedCount: number;
  onSelectPage: (selected: boolean) => void;
  onDelete: () => void;
  onRefresh: () => void;
  deleteButtonId: string;
}

export function ArchiveSelectionToolbar({
  eligibleCount,
  selectedCount,
  onSelectPage,
  onDelete,
  onRefresh,
  deleteButtonId,
}: ArchiveSelectionToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-ink bg-paper-muted px-4 py-2">
      <Checkbox
        id="archive-select-page"
        label="Select all deletable records on this page"
        checked={eligibleCount > 0 && selectedCount === eligibleCount}
        disabled={eligibleCount === 0}
        onChange={onSelectPage}
      />
      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <span className="text-sm text-ink-secondary" aria-live="polite">
          {selectedCount} selected
        </span>
        <Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>
        <Button id={deleteButtonId} variant="destructive" size="sm" disabled={selectedCount === 0} onClick={onDelete}>
          Delete selected
        </Button>
      </div>
    </div>
  );
}

interface ArchivePagerProps {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function ArchivePager({ page, hasMore, onPageChange }: ArchivePagerProps) {
  return (
    <nav aria-label="Archived records pages" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="font-mono text-xs text-ink-secondary">Page {page}</span>
      <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
