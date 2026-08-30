// Manages agenda event category definitions, badges, and accent color styles.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Panel } from '../../../components/ui/Panel';
import {
  CATEGORY_ACCENT_CONFIGS,
  INITIAL_AGENDA_CATEGORIES,
  type AgendaCategoryItem,
  type CategoryAccentColor,
} from '../settings-types';

export function AgendaCategorySettingsTab() {
  const [categories, setCategories] = useState<AgendaCategoryItem[]>(INITIAL_AGENDA_CATEGORIES);
  const [activeNotice, setActiveNotice] = useState<string | null>(null);

  // Dialog State: 'new' | 'edit' | 'delete' | null
  const [dialogMode, setDialogMode] = useState<'new' | 'edit' | 'delete' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AgendaCategoryItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formAccent, setFormAccent] = useState<CategoryAccentColor>('signal-blue');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openNewDialog = () => {
    setSelectedCategory(null);
    setFormName('');
    setFormShortCode('');
    setFormAccent('signal-blue');
    setFormDescription('');
    setFormError(null);
    setDialogMode('new');
  };

  const openEditDialog = (category: AgendaCategoryItem) => {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormShortCode(category.shortCode);
    setFormAccent(category.accent);
    setFormDescription(category.description);
    setFormError(null);
    setDialogMode('edit');
  };

  const openDeleteDialog = (category: AgendaCategoryItem) => {
    setSelectedCategory(category);
    setDialogMode('delete');
  };

  const handleSaveCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formName.trim()) {
      setFormError('Category name is required.');
      return;
    }
    if (!formShortCode.trim()) {
      setFormError('Short code is required.');
      return;
    }

    const cleanShortCode = formShortCode.trim().toUpperCase();

    if (dialogMode === 'new') {
      const newCategory: AgendaCategoryItem = {
        id: `cat-${Date.now()}`,
        name: formName.trim(),
        shortCode: cleanShortCode,
        accent: formAccent,
        description: formDescription.trim(),
        isSystem: false,
        isActive: true,
      };
      setCategories((prev) => [...prev, newCategory]);
      setActiveNotice(`Created event category "${newCategory.name}" (UI Preview).`);
    } else if (dialogMode === 'edit' && selectedCategory) {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === selectedCategory.id
            ? {
                ...cat,
                name: formName.trim(),
                shortCode: cleanShortCode,
                accent: formAccent,
                description: formDescription.trim(),
              }
            : cat
        )
      );
      setActiveNotice(`Updated category "${formName.trim()}".`);
    }

    setDialogMode(null);
    setTimeout(() => setActiveNotice(null), 4000);
  };

  const handleDeleteConfirm = () => {
    if (!selectedCategory) return;
    setCategories((prev) => prev.filter((cat) => cat.id !== selectedCategory.id));
    setActiveNotice(`Deleted category "${selectedCategory.name}".`);
    setDialogMode(null);
    setTimeout(() => setActiveNotice(null), 4000);
  };

  const handleToggleActive = (category: AgendaCategoryItem) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === category.id ? { ...cat, isActive: !cat.isActive } : cat
      )
    );
  };

  const selectedAccentConfig = CATEGORY_ACCENT_CONFIGS[formAccent];

  return (
    <div className="space-y-8">
      {activeNotice && (
        <Notice
          variant="success"
          title="Agenda Category Updated"
          onDismiss={() => setActiveNotice(null)}
        >
          {activeNotice}
        </Notice>
      )}

      <Panel
        header="Agenda Event Classifications"
        sectionNumber="01"
        showCrosshairs={false}
        className="bg-paper-light"
        badge={
          <Button variant="primary" size="sm" onClick={openNewDialog}>
            + New Category
          </Button>
        }
      >
        <p className="mb-6 text-xs leading-relaxed text-ink-secondary">
          Define event categories used to classify examinations, project deadlines, consultations, and meetings on the calendar docket.
        </p>

        <div className="overflow-x-auto border border-ink">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-ink bg-paper-muted font-mono uppercase tracking-[0.12em] text-ink-muted">
              <tr>
                <th className="px-4 py-3">Accent</th>
                <th className="px-4 py-3">Category Name</th>
                <th className="px-4 py-3">Short Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-border bg-paper-light">
              {categories.map((cat) => {
                const config = CATEGORY_ACCENT_CONFIGS[cat.accent];
                return (
                  <tr key={cat.id} className="transition-colors hover:bg-paper">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-3 w-3 rounded-full ${config.pipColor}`}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-[10px] text-ink-muted">
                          {config.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-ink">
                      <div className="flex items-center gap-2">
                        <span>{cat.name}</span>
                        {!cat.isActive && (
                          <span className="border border-paper-dark bg-paper-muted px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                            Hidden
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-ink">
                      <span
                        className={`inline-flex items-center border px-2 py-0.5 text-[11px] uppercase tracking-wider ${config.badgeStyle}`}
                      >
                        {cat.shortCode}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-ink-secondary">
                      {cat.description || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] uppercase">
                      {cat.isSystem ? (
                        <span className="text-ink-muted">System</span>
                      ) : (
                        <span className="font-semibold text-signal-blue">Custom</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(cat)}
                        className={`border px-2 py-1 text-[10px] uppercase font-bold cursor-pointer transition-colors ${
                          cat.isActive
                            ? 'border-ink bg-ink text-paper-light hover:bg-neutral-800'
                            : 'border-paper-dark bg-paper text-ink-faint hover:text-ink'
                        }`}
                      >
                        {cat.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDialog(cat)}
                          className="px-2 py-1 border border-paper-dark bg-paper-light text-ink hover:border-ink hover:bg-paper uppercase font-bold text-[10px]"
                        >
                          Edit
                        </button>
                        {!cat.isSystem && (
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(cat)}
                            className="px-2 py-1 border border-signal-red/30 bg-red-50/50 text-signal-red hover:border-signal-red hover:bg-red-100 uppercase font-bold text-[10px]"
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Add / Edit Category Dialog */}
      <Dialog
        isOpen={dialogMode === 'new' || dialogMode === 'edit'}
        onClose={() => setDialogMode(null)}
        title={dialogMode === 'new' ? 'New Agenda Category' : 'Edit Agenda Category'}
        description="Configure event classification label, short code, and calendar docket badge style."
      >
        <form onSubmit={handleSaveCategory} className="space-y-5">
          {formError && (
            <Notice variant="error" title="Validation Error">
              {formError}
            </Notice>
          )}

          <Input
            label="Category Name"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Thesis Consultation, Make-up Exam"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Short Code (Max 8 chars)"
              required
              isMonospace
              maxLength={8}
              value={formShortCode}
              onChange={(e) => setFormShortCode(e.target.value.toUpperCase())}
              placeholder="e.g., THESIS"
              hint="Rendered on day docket calendar badges"
            />

            <div>
              <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Accent Color
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  Object.keys(
                    CATEGORY_ACCENT_CONFIGS
                  ) as CategoryAccentColor[]
                ).map((colorKey) => {
                  const cfg = CATEGORY_ACCENT_CONFIGS[colorKey];
                  const isSelected = formAccent === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setFormAccent(colorKey)}
                      aria-label={`Select ${cfg.label}`}
                      className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[11px] uppercase transition-all cursor-pointer ${
                        isSelected
                          ? 'border-ink bg-ink text-paper-light font-bold ring-1 ring-ink'
                          : 'border-paper-border bg-paper-light text-ink hover:border-paper-dark'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${cfg.pipColor}`}
                        aria-hidden="true"
                      />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Input
            label="Description (Optional)"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Brief explanation of when this event category applies"
          />

          {/* Live Badge Preview */}
          <div className="border border-dashed border-paper-dark bg-paper p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Live Docket Preview
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs uppercase font-bold tracking-wider ${selectedAccentConfig.badgeStyle}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${selectedAccentConfig.pipColor}`}
                  aria-hidden="true"
                />
                <span>{formShortCode.trim() || 'CODE'}</span>
              </span>
              <span className="font-sans text-sm font-semibold text-ink">
                {formName.trim() || 'Category Title Preview'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-paper-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogMode(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {dialogMode === 'new' ? 'Create Category' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={dialogMode === 'delete'}
        onClose={() => setDialogMode(null)}
        title="Delete Event Category"
        description="Are you sure you want to remove this category? Events currently using this category will remain in records."
      >
        <div className="space-y-4">
          {selectedCategory && (
            <div className="border border-paper-border bg-paper p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                Category to remove:
              </p>
              <p className="mt-1 font-sans text-base font-bold text-ink">
                {selectedCategory.name} ({selectedCategory.shortCode})
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
