// Coordinates paged archived records and current-page deletion selection for both workspaces.
import { useEffect, useState } from 'react';
import { ArchiveApiError } from './archive-api';
import type { ArchivePage } from './archive-types';

type ArchivedRow = { id: string; canDelete: boolean };
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useArchivedDirectory<Row extends ArchivedRow>(
  enabled: boolean,
  fetchPage: (page: number, signal: AbortSignal) => Promise<ArchivePage<Row>>,
  onSessionExpired: () => void,
) {
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    fetchPage(page, controller.signal)
      .then((result) => {
        setRecords(result.records);
        setHasMore(result.hasMore);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ArchiveApiError && error.status === 401) {
          onSessionExpired();
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the archive.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [enabled, fetchPage, onSessionExpired, page, revision]);

  const changePage = (nextPage: number) => {
    setSelectedIds([]);
    setLoadStatus('loading');
    setLoadError('');
    setPage(nextPage);
  };

  const toggleSelected = (id: string) => {
    if (!records.some((record) => record.id === id && record.canDelete)) return;
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const eligibleIds = records.filter((record) => record.canDelete).map((record) => record.id);
  const selectPage = (selected: boolean) => {
    setSelectedIds(selected ? eligibleIds : []);
  };

  const refresh = () => {
    setSelectedIds([]);
    setLoadStatus('loading');
    setLoadError('');
    setRevision((value) => value + 1);
  };

  const onDeleted = () => {
    setSelectedIds([]);
    setLoadStatus('loading');
    setLoadError('');
    setPage(1);
    setRevision((value) => value + 1);
  };

  return {
    page,
    records,
    hasMore,
    loadStatus,
    loadError,
    selectedIds,
    eligibleIds,
    toggleSelected,
    selectPage,
    changePage,
    refresh,
    onDeleted,
  };
}
