// Manages persisted per-user Agenda categories through immediate confirmed server mutations.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import PageLoad from '../../../components/ui/PageLoad';
import { Panel } from '../../../components/ui/Panel';
import {
  createAgendaCategory,
  deleteAgendaCategory,
  fetchAgendaCategories,
  restoreDefaultAgendaCategories,
  updateAgendaCategory,
} from '../../agenda/agenda-category-api';
import { AgendaApiError } from '../../agenda/agenda-api';
import {
  AGENDA_CATEGORY_ACCENTS,
  type AgendaCategory,
  type AgendaCategoryAccentKey,
} from '../../agenda/agenda-types';

interface AgendaCategorySettingsTabProps {
  onSessionExpired: () => void;
}

type DialogMode = 'new' | 'edit' | 'delete' | 'restore' | null;
type CategoryMutation =
  | { kind: 'save' }
  | { kind: 'toggle'; categoryId: string }
  | { kind: 'delete'; categoryId: string }
  | { kind: 'restore' }
  | null;

interface CategoryActionsProps {
  category: AgendaCategory;
  mutation: CategoryMutation;
  className?: string;
  onEdit: (category: AgendaCategory) => void;
  onToggle: (category: AgendaCategory) => void;
  onRemove: (category: AgendaCategory) => void;
}

function sortCategories(categories: AgendaCategory[]) {
  return [...categories].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.name.localeCompare(right.name) ||
      left.shortCode.localeCompare(right.shortCode) ||
      left.id.localeCompare(right.id);
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

// Keeps category actions consistent between the desktop table and mobile record cards.
function CategoryActions({
  category,
  mutation,
  className = '',
  onEdit,
  onToggle,
  onRemove,
}: CategoryActionsProps) {
  const isMutating = mutation !== null;
  const isToggling = mutation?.kind === 'toggle' && mutation.categoryId === category.id;

  return (
    <div className={className}>
      <Button
        size="xs"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={isMutating}
        onClick={() => onEdit(category)}
      >
        Edit
      </Button>
      <Button
        size="xs"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={isMutating}
        isLoading={isToggling}
        onClick={() => onToggle(category)}
      >
        {isToggling
          ? category.isActive ? 'Deactivating…' : 'Reactivating…'
          : category.isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      <Button
        size="xs"
        variant="destructive"
        className="min-h-11 w-full sm:w-auto"
        disabled={isMutating}
        onClick={() => onRemove(category)}
      >
        Remove
      </Button>
    </div>
  );
}

export function AgendaCategorySettingsTab({
  onSessionExpired,
}: AgendaCategorySettingsTabProps) {
  const [categories, setCategories] = useState<AgendaCategory[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeNotice, setActiveNotice] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<AgendaCategory | null>(null);
  const [mutation, setMutation] = useState<CategoryMutation>(null);
  const [formName, setFormName] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formAccent, setFormAccent] = useState<AgendaCategoryAccentKey>('SIGNAL_BLUE');
  const [formDescription, setFormDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const shortCodeInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const accentFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const isMutating = mutation !== null;

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;
    fetchAgendaCategories(controller.signal)
      .then((loadedCategories) => {
        if (!isCurrentRequest) return;
        setCategories(sortCategories(loadedCategories));
        setLoadError('');
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !isCurrentRequest) return;
        if (error instanceof AgendaApiError && error.status === 401) {
          onSessionExpired();
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load Agenda categories.');
        setLoadStatus('error');
      });
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [loadAttempt, onSessionExpired]);

  const handleApiError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof AgendaApiError && error.status === 401) {
      onSessionExpired();
      return;
    }
    if (error instanceof AgendaApiError) {
      const nextFieldErrors = Object.fromEntries(
        Object.entries(error.fieldErrors)
          .filter((entry): entry is [string, string[]] => Boolean(entry[1][0]))
          .map(([field, messages]) => [field, messages[0]]),
      );
      setFieldErrors(nextFieldErrors);
      setMutationError(error.message);
      if (dialogMode === 'new' || dialogMode === 'edit') {
        const firstInvalidField = ['name', 'shortCode', 'description', 'accentKey']
          .find((field) => nextFieldErrors[field]);
        const fieldRefs = {
          name: nameInputRef,
          shortCode: shortCodeInputRef,
          description: descriptionInputRef,
          accentKey: accentFieldsetRef,
        };
        if (firstInvalidField && firstInvalidField in fieldRefs) {
          window.requestAnimationFrame(() => {
            fieldRefs[firstInvalidField as keyof typeof fieldRefs].current?.focus();
          });
        }
      }
      return;
    }
    setMutationError(error instanceof Error ? error.message : fallback);
  }, [dialogMode, onSessionExpired]);

  const openNewDialog = () => {
    setSelectedCategory(null);
    setFormName('');
    setFormShortCode('');
    setFormAccent('SIGNAL_BLUE');
    setFormDescription('');
    setFieldErrors({});
    setMutationError(null);
    setDialogMode('new');
  };

  const openEditDialog = (category: AgendaCategory) => {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormShortCode(category.shortCode);
    setFormAccent(category.accentKey);
    setFormDescription(category.description ?? '');
    setFieldErrors({});
    setMutationError(null);
    setDialogMode('edit');
  };

  const openRemoveDialog = (category: AgendaCategory) => {
    setSelectedCategory(category);
    setMutationError(null);
    setDialogMode('delete');
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setMutationError(null);
  };

  const replaceCategory = (category: AgendaCategory) => {
    setCategories((current) => sortCategories([
      category,
      ...current.filter((item) => item.id !== category.id),
    ]));
  };

  const handleSaveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isMutating) return;
    setMutation({ kind: 'save' });
    setActiveNotice(null);
    setMutationError(null);
    setFieldErrors({});
    try {
      const input = {
        name: formName,
        shortCode: formShortCode,
        accentKey: formAccent,
        description: formDescription || null,
      };
      const category = dialogMode === 'edit' && selectedCategory
        ? await updateAgendaCategory(selectedCategory.id, {
            ...input,
            isActive: selectedCategory.isActive,
          })
        : await createAgendaCategory(input);
      replaceCategory(category);
      setActiveNotice(
        dialogMode === 'edit'
          ? `Updated “${category.name}”.`
          : `Created “${category.name}”.`,
      );
      setDialogMode(null);
    } catch (error) {
      handleApiError(error, 'Unable to save this Agenda category.');
    } finally {
      setMutation(null);
    }
  };

  const handleToggleActive = async (category: AgendaCategory) => {
    if (isMutating) return;
    setMutation({ kind: 'toggle', categoryId: category.id });
    setActiveNotice(null);
    setMutationError(null);
    setFieldErrors({});
    try {
      const updated = await updateAgendaCategory(category.id, {
        name: category.name,
        shortCode: category.shortCode,
        accentKey: category.accentKey,
        description: category.description,
        isActive: !category.isActive,
      });
      replaceCategory(updated);
      setActiveNotice(`${updated.name} is now ${updated.isActive ? 'active' : 'inactive'}.`);
    } catch (error) {
      handleApiError(error, 'Unable to update category visibility.');
    } finally {
      setMutation(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCategory || isMutating) return;
    setMutation({ kind: 'delete', categoryId: selectedCategory.id });
    setActiveNotice(null);
    setMutationError(null);
    try {
      const result = await deleteAgendaCategory(selectedCategory.id);
      if (result === 'DELETED') {
        setCategories((current) => current.filter((category) => category.id !== selectedCategory.id));
      } else {
        setCategories((current) => current.map((category) =>
          category.id === selectedCategory.id ? { ...category, isActive: false } : category
        ));
      }
      setActiveNotice(
        result === 'DELETED'
          ? `Deleted unused custom category “${selectedCategory.name}”.`
          : `Deactivated “${selectedCategory.name}”; existing events retain it.`,
      );
      setDialogMode(null);
    } catch (error) {
      handleApiError(error, 'Unable to remove this Agenda category.');
    } finally {
      setMutation(null);
    }
  };

  const handleRestoreDefaults = async () => {
    if (isMutating) return;
    setMutation({ kind: 'restore' });
    setActiveNotice(null);
    setMutationError(null);
    try {
      const restored = await restoreDefaultAgendaCategories();
      setCategories(sortCategories(restored));
      setActiveNotice('Restored and reactivated the six default Agenda categories.');
      setDialogMode(null);
    } catch (error) {
      handleApiError(error, 'Unable to restore default Agenda categories.');
    } finally {
      setMutation(null);
    }
  };

  if (loadStatus === 'loading') return <PageLoad message="Loading Agenda categories…" />;

  if (loadStatus === 'error') {
    return (
      <Panel header="Agenda Categories Unavailable" sectionNumber="01" showCrosshairs={false}>
        <div className="space-y-4">
          <Notice variant="error" title="Unable to load categories">{loadError}</Notice>
          <Button
            variant="outline"
            onClick={() => {
              setLoadStatus('loading');
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </Panel>
    );
  }

  const selectedAccent = AGENDA_CATEGORY_ACCENTS[formAccent];

  return (
    <div className="space-y-6">
      {activeNotice ? (
        <Notice variant="success" title="Agenda Categories Updated" onDismiss={() => setActiveNotice(null)}>
          {activeNotice}
        </Notice>
      ) : null}
      {mutationError && dialogMode === null ? (
        <Notice variant="error" title="Category not updated" onDismiss={() => setMutationError(null)}>
          {mutationError}
        </Notice>
      ) : null}

      <Panel
        header="Agenda Event Classifications"
        sectionNumber="01"
        showCrosshairs={false}
        className="bg-paper-light"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
            Categories classify calendar events. Inactive categories remain visible on existing records
            but cannot be selected for new events.
          </p>
          <Button
            className="w-full shrink-0 sm:w-auto"
            variant="primary"
            size="sm"
            disabled={isMutating}
            onClick={openNewDialog}
          >
            + New Category
          </Button>
        </div>

        <div className="hidden overflow-x-auto border border-ink xl:block">
          <table className="w-full min-w-[880px] text-left font-sans text-xs">
            <thead className="border-b border-ink bg-paper-muted font-mono uppercase tracking-[0.12em] text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Accent</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Short Code</th>
                <th scope="col" className="px-4 py-3">Description</th>
                <th scope="col" className="px-4 py-3">Origin</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-border bg-paper-light">
              {categories.map((category) => {
                const accent = AGENDA_CATEGORY_ACCENTS[category.accentKey];
                return (
                  <tr key={category.id} className="hover:bg-paper">
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${accent.pipColor}`} aria-hidden="true" />
                        <span className="font-mono text-[10px] text-ink-muted">{accent.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-ink">{category.name}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${accent.badgeStyle}`}>
                        {category.shortCode}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3.5 text-ink-secondary">{category.description || '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] uppercase text-ink-muted">
                      {category.isDefault ? 'Default' : 'Custom'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] font-bold uppercase">
                      {category.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-4 py-3.5">
                      <CategoryActions
                        category={category}
                        mutation={mutation}
                        className="flex justify-end gap-2"
                        onEdit={openEditDialog}
                        onToggle={(item) => void handleToggleActive(item)}
                        onRemove={openRemoveDialog}
                      />
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-muted">
                    No categories are available. Restore the defaults to continue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 xl:hidden" aria-label="Agenda categories">
          {categories.map((category) => {
            const accent = AGENDA_CATEGORY_ACCENTS[category.accentKey];
            return (
              <li key={category.id} className="min-w-0 border border-ink bg-paper-light p-4">
                <div className="flex min-w-0 flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`h-3 w-3 shrink-0 rounded-full ${accent.pipColor}`} aria-hidden="true" />
                      <h3 className="break-words text-sm font-semibold text-ink">{category.name}</h3>
                      <span className={`inline-flex max-w-full break-all border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${accent.badgeStyle}`}>
                        {category.shortCode}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm leading-5 text-ink-secondary">
                      {category.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 font-mono text-[11px] uppercase text-ink-muted">
                    <span>{accent.label}</span>
                    <span aria-hidden="true">/</span>
                    <span>{category.isDefault ? 'Default' : 'Custom'}</span>
                    <span aria-hidden="true">/</span>
                    <span className="font-bold text-ink">{category.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <CategoryActions
                  category={category}
                  mutation={mutation}
                  className="mt-4 grid gap-2 min-[540px]:grid-cols-3"
                  onEdit={openEditDialog}
                  onToggle={(item) => void handleToggleActive(item)}
                  onRemove={openRemoveDialog}
                />
              </li>
            );
          })}
          {categories.length === 0 ? (
            <li className="border border-ink bg-paper-light px-4 py-10 text-center text-sm text-ink-muted">
              No categories are available. Restore the defaults to continue.
            </li>
          ) : null}
        </ul>

        <div className="mt-4 flex flex-col gap-3 border-t border-paper-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            disabled={isMutating}
            onClick={() => {
              setMutationError(null);
              setFieldErrors({});
              setDialogMode('restore');
            }}
          >
            Restore Default Categories
          </Button>
          <p className="font-mono text-xs text-ink-muted">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} configured
          </p>
        </div>
      </Panel>

      <Dialog
        isOpen={dialogMode === 'new' || dialogMode === 'edit'}
        isDismissDisabled={isMutating}
        initialFocusRef={nameInputRef}
        onClose={() => setDialogMode(null)}
        title={dialogMode === 'new' ? 'New Agenda Category' : 'Edit Agenda Category'}
        description="Configure the label, short code, semantic accent, and description."
      >
        <form onSubmit={handleSaveCategory} className="space-y-5" noValidate aria-busy={isMutating || undefined}>
          {mutationError ? <Notice variant="error" title="Category not saved">{mutationError}</Notice> : null}
          <Input ref={nameInputRef} id="agenda-category-name" label="Category Name" required maxLength={120} value={formName} disabled={isMutating} onChange={(event) => { setFormName(event.target.value); clearFieldError('name'); }} error={fieldErrors.name} />
          <Input ref={shortCodeInputRef} id="agenda-category-short-code" label="Short Code" required isMonospace maxLength={12} value={formShortCode} disabled={isMutating} onChange={(event) => { setFormShortCode(event.target.value.toUpperCase()); clearFieldError('shortCode'); }} hint="Use 1–12 letters, numbers, hyphens, or underscores." error={fieldErrors.shortCode} />
          <Input ref={descriptionInputRef} id="agenda-category-description" label="Description" optional maxLength={500} value={formDescription} disabled={isMutating} onChange={(event) => { setFormDescription(event.target.value); clearFieldError('description'); }} error={fieldErrors.description} />
          <fieldset
            ref={accentFieldsetRef}
            tabIndex={-1}
            disabled={isMutating}
            aria-invalid={Boolean(fieldErrors.accentKey)}
            aria-describedby={fieldErrors.accentKey ? 'agenda-category-accent-error' : undefined}
          >
            <legend className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">Accent</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(AGENDA_CATEGORY_ACCENTS) as AgendaCategoryAccentKey[]).map((accentKey) => {
                const accent = AGENDA_CATEGORY_ACCENTS[accentKey];
                return (
                  <button
                    key={accentKey}
                    type="button"
                    aria-pressed={formAccent === accentKey}
                    onClick={() => {
                      setFormAccent(accentKey);
                      clearFieldError('accentKey');
                    }}
                    className={`flex min-h-11 items-center gap-2 border px-3 py-2 font-mono text-[11px] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                      formAccent === accentKey ? 'border-ink bg-ink text-paper-light' : 'border-paper-border bg-paper-light text-ink hover:border-ink'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${accent.pipColor}`} aria-hidden="true" />
                    {accent.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.accentKey ? (
              <p id="agenda-category-accent-error" className="mt-2 flex items-center gap-1 font-mono text-xs text-signal-red">
                <span aria-hidden="true">/!/</span>
                <span>{fieldErrors.accentKey}</span>
              </p>
            ) : null}
          </fieldset>
          <div className="border border-dashed border-paper-dark bg-paper p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Docket Preview</p>
            <span className={`mt-2 inline-flex border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ${selectedAccent.badgeStyle}`}>
              {formShortCode.trim() || 'CODE'}
            </span>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-paper-border pt-4 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" type="button" variant="secondary" disabled={isMutating} onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button className="w-full sm:w-auto" type="submit" variant="primary" isLoading={mutation?.kind === 'save'}>
              {mutation?.kind === 'save'
                ? dialogMode === 'new' ? 'Creating Category…' : 'Saving Changes…'
                : dialogMode === 'new' ? 'Create Category' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'delete'}
        isDismissDisabled={isMutating}
        onClose={() => setDialogMode(null)}
        title="Remove Agenda category?"
        description="Unused custom categories are deleted. Default categories and categories used by events are deactivated so existing events retain their classification."
        footer={(
          <>
            <Button variant="secondary" disabled={isMutating} onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button variant="destructive" isLoading={mutation?.kind === 'delete'} onClick={() => void handleDeleteConfirm()}>
              {mutation?.kind === 'delete' ? 'Removing Category…' : 'Remove Category'}
            </Button>
          </>
        )}
      >
        {mutationError ? <Notice variant="error" title="Category not removed">{mutationError}</Notice> : null}
        {selectedCategory ? (
          <p className="text-sm text-ink-secondary">
            Selected: <strong className="text-ink">{selectedCategory.name} ({selectedCategory.shortCode})</strong>
          </p>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'restore'}
        isDismissDisabled={isMutating}
        onClose={() => setDialogMode(null)}
        title="Restore default categories?"
        description="The six defaults return to their canonical names, codes, descriptions, accents, and active state. Custom categories and all events remain unchanged."
        footer={(
          <>
            <Button variant="secondary" disabled={isMutating} onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button variant="primary" isLoading={mutation?.kind === 'restore'} onClick={() => void handleRestoreDefaults()}>
              {mutation?.kind === 'restore' ? 'Restoring Defaults…' : 'Restore Defaults'}
            </Button>
          </>
        )}
      >
        {mutationError ? <Notice variant="error" title="Defaults not restored">{mutationError}</Notice> : null}
        <p className="text-sm leading-6 text-ink-secondary">Existing event-category relationships are preserved throughout the restore.</p>
      </Dialog>
    </div>
  );
}
