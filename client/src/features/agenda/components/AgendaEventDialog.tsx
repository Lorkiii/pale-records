// Provides an asynchronous Agenda event form that preserves input and errors until server success.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Notice } from '../../../components/ui/Notice';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import { AgendaApiError } from '../agenda-api';
import {
  type AgendaCategory,
  type AgendaEvent,
  type CreateAgendaEventInput,
  type UpdateAgendaEventInput,
} from '../agenda-types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

interface SubmissionError {
  message: string;
  details: string[];
}

interface AgendaEventFormProps {
  classes: ClassRecord[];
  categories: AgendaCategory[];
  isClassSelectionAvailable: boolean;
  isSaving: boolean;
  initialDateKey: string;
  editingEvent: AgendaEvent | null;
  onCancel: () => void;
  onSavingChange: (isSaving: boolean) => void;
  onSave: (data: CreateAgendaEventInput | UpdateAgendaEventInput) => Promise<void>;
}

// Validates a date-only form value without browser-local date conversion.
function isRealDateOnly(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function AgendaEventForm({
  classes,
  categories,
  isClassSelectionAvailable,
  isSaving,
  initialDateKey,
  editingEvent,
  onCancel,
  onSavingChange,
  onSave,
}: AgendaEventFormProps) {
  const [title, setTitle] = useState(() => editingEvent?.title ?? '');
  const [categoryId, setCategoryId] = useState(
    () => editingEvent?.categoryId ?? categories.find((category) => category.isActive)?.id ?? '',
  );
  const [classId, setClassId] = useState<string>(() => editingEvent?.classId ?? 'NONE');
  const [eventDate, setEventDate] = useState(() => editingEvent?.eventDate ?? initialDateKey);
  const [isAllDay, setIsAllDay] = useState(() => editingEvent?.isAllDay ?? false);
  const [startTime, setStartTime] = useState(() => editingEvent?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(() => editingEvent?.endTime ?? '10:30');
  const [location, setLocation] = useState(() => editingEvent?.location ?? '');
  const [description, setDescription] = useState(() => editingEvent?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<SubmissionError | null>(null);

  // Preserves the existing room auto-fill when a loaded Class is deliberately selected.
  const handleClassChange = (selectedId: string) => {
    setClassId(selectedId);
    if (selectedId !== 'NONE' && !location.trim()) {
      const selectedClass = classes.find((classRecord) => classRecord.id === selectedId);
      if (selectedClass?.room) {
        setLocation(selectedClass.room);
      }
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedLocation = location.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Event title is required.';
    } else if (trimmedTitle.length > 160) {
      nextErrors.title = 'Event title must be at most 160 characters.';
    }

    if (trimmedDescription.length > 2000) {
      nextErrors.description = 'Agenda notes must be at most 2000 characters.';
    }

    if (trimmedLocation.length > 160) {
      nextErrors.location = 'Location must be at most 160 characters.';
    }

    if (!isRealDateOnly(eventDate)) {
      nextErrors.eventDate = 'Choose a valid event date.';
    }

    if (!categories.some((category) => category.id === categoryId && (
      category.isActive || editingEvent?.categoryId === category.id
    ))) {
      nextErrors.categoryId = 'Choose an available Agenda category.';
    }

    if (!isAllDay && startTime && !TIME_PATTERN.test(startTime)) {
      nextErrors.startTime = 'Start time must use the HH:MM 24-hour format.';
    }

    if (!isAllDay && endTime && !TIME_PATTERN.test(endTime)) {
      nextErrors.endTime = 'End time must use the HH:MM 24-hour format.';
    }

    if (!isAllDay && startTime && endTime && startTime >= endTime) {
      nextErrors.endTime = 'End time must be after start time.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmissionError({
        message: 'Review the highlighted fields before saving this Agenda event.',
        details: [],
      });
      return false;
    }

    return true;
  };

  // Maps safe server field details onto the existing controls and persistent dialog notice.
  const showSubmissionError = (error: unknown) => {
    if (!(error instanceof AgendaApiError)) {
      setSubmissionError({
        message: error instanceof Error
          ? error.message
          : 'Unable to save this Agenda event. Please try again.',
        details: [],
      });
      return;
    }

    const recognizedFields = new Set([
      'title',
      'description',
      'eventDate',
      'startTime',
      'endTime',
      'isAllDay',
      'categoryId',
      'classId',
      'location',
    ]);
    const nextErrors: Record<string, string> = {};
    const unmatchedFieldMessages: string[] = [];

    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (recognizedFields.has(field) && messages[0]) {
        nextErrors[field] = messages[0];
      } else {
        unmatchedFieldMessages.push(...messages);
      }
    }

    setErrors(nextErrors);
    setSubmissionError({
      message: error.message,
      details: [...new Set([...error.formErrors, ...unmatchedFieldMessages])],
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving || !validate()) return;

    onSavingChange(true);
    setSubmissionError(null);
    try {
      await onSave({
        title: title.trim(),
        categoryId,
        classId: classId === 'NONE' ? undefined : classId,
        eventDate,
        isAllDay,
        startTime: isAllDay ? undefined : startTime || undefined,
        endTime: isAllDay ? undefined : endTime || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
    } catch (error: unknown) {
      showSubmissionError(error);
    } finally {
      onSavingChange(false);
    }
  };

  const categoryOptions: SelectOption[] = categories
    .filter((category) => category.isActive || category.id === editingEvent?.categoryId)
    .map((category) => ({
      value: category.id,
      label: category.isActive ? category.name : `${category.name} (Current, inactive)`,
    }));

  const hasUnavailableCurrentClass = Boolean(
    editingEvent?.classId && !classes.some((classRecord) => classRecord.id === editingEvent.classId),
  );
  const classOptions: SelectOption[] = [
    ...(hasUnavailableCurrentClass && editingEvent?.classId
      ? [{ value: editingEvent.classId, label: 'Current associated Class' }]
      : []),
    { value: 'NONE', label: 'None (General / Personal Academic)' },
    ...classes.map((classRecord) => ({
      value: classRecord.id,
      label: classRecord.section
        ? `${classRecord.subjectName} (${classRecord.section})`
        : classRecord.subjectCode
          ? `${classRecord.subjectCode} - ${classRecord.subjectName}`
          : classRecord.subjectName,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submissionError ? (
        <Notice variant="error" title={editingEvent ? 'Event not updated' : 'Event not scheduled'}>
          <div className="space-y-2">
            <p>{submissionError.message}</p>
            {submissionError.details.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4">
                {submissionError.details.map((message) => <li key={message}>{message}</li>)}
              </ul>
            ) : null}
          </div>
        </Notice>
      ) : null}

      <Input
        id="event-title"
        label="Event Title"
        required
        maxLength={160}
        value={title}
        disabled={isSaving}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="e.g. Prelim Examination, Project Milestone 1"
        error={errors.title}
        isMonospace={false}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="event-category"
          label="Category"
          required
          value={categoryId}
          disabled={isSaving}
          onChange={(event) => setCategoryId(event.target.value)}
          options={categoryOptions}
          error={errors.categoryId}
        />

        <Select
          id="event-class"
          label="Associated Class"
          value={classId}
          disabled={isSaving || !isClassSelectionAvailable}
          onChange={(event) => handleClassChange(event.target.value)}
          options={classOptions}
          error={errors.classId}
          hint={!isClassSelectionAvailable
            ? 'Class choices are unavailable until the Class directory loads.'
            : undefined}
        />
      </div>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
        <Input
          id="event-date"
          type="date"
          label="Date"
          required
          value={eventDate}
          disabled={isSaving}
          onChange={(event) => setEventDate(event.target.value)}
          error={errors.eventDate}
          isMonospace
        />

        <div className="pb-3">
          <Checkbox
            id="event-all-day"
            label="All-Day Event"
            checked={isAllDay}
            disabled={isSaving}
            error={errors.isAllDay}
            onChange={(checked) => setIsAllDay(checked)}
          />
        </div>
      </div>

      {!isAllDay ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="event-start-time"
            type="time"
            label="Start Time"
            value={startTime}
            disabled={isSaving}
            onChange={(event) => setStartTime(event.target.value)}
            error={errors.startTime}
            isMonospace
          />
          <Input
            id="event-end-time"
            type="time"
            label="End Time"
            value={endTime}
            disabled={isSaving}
            onChange={(event) => setEndTime(event.target.value)}
            error={errors.endTime}
            isMonospace
          />
        </div>
      ) : null}

      <Input
        id="event-location"
        label="Location / Room"
        optional
        maxLength={160}
        value={location}
        disabled={isSaving}
        onChange={(event) => setLocation(event.target.value)}
        placeholder="e.g. Room 402, Computer Lab 1, Online"
        error={errors.location}
        isMonospace
      />

      <div>
        <Label htmlFor="event-description" optional>
          Agenda Notes & Coverage
        </Label>
        <textarea
          id="event-description"
          rows={3}
          maxLength={2000}
          value={description}
          disabled={isSaving}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'event-description-error' : undefined}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Coverage topics, materials needed, submission links..."
          className={`w-full resize-y rounded-none border bg-white p-3 font-sans text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-50 ${
            errors.description
              ? 'border-red-600 focus:border-red-600 focus:ring-red-600'
              : 'border-neutral-400 focus:border-black focus:ring-black'
          }`}
        />
        {errors.description ? (
          <p id="event-description-error" className="mt-1 flex items-center gap-1 font-mono text-xs text-red-600">
            <span aria-hidden="true">/!/</span>
            <span>{errors.description}</span>
          </p>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button variant="primary" size="md" type="submit" isLoading={isSaving}>
          {isSaving
            ? editingEvent ? 'Saving Changes' : 'Scheduling Event'
            : editingEvent ? 'Save Changes' : 'Schedule Event'}
        </Button>
      </div>
    </form>
  );
}

interface AgendaEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassRecord[];
  categories: AgendaCategory[];
  isClassSelectionAvailable: boolean;
  initialDateKey: string;
  editingEvent: AgendaEvent | null;
  onSave: (data: CreateAgendaEventInput | UpdateAgendaEventInput) => Promise<void>;
}

export function AgendaEventDialog({
  isOpen,
  onClose,
  classes,
  categories,
  isClassSelectionAvailable,
  initialDateKey,
  editingEvent,
  onSave,
}: AgendaEventDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingEvent ? 'Edit Agenda Event' : 'Add Agenda Event'}
      description={editingEvent
        ? 'Update the details or date for this academic milestone.'
        : 'Schedule a new milestone, exam, deadline, or reminder on this date.'}
      isDismissDisabled={isSaving}
    >
      <AgendaEventForm
        key={`${editingEvent?.id ?? 'new'}-${initialDateKey}`}
        classes={classes}
        categories={categories}
        isClassSelectionAvailable={isClassSelectionAvailable}
        isSaving={isSaving}
        initialDateKey={initialDateKey}
        editingEvent={editingEvent}
        onCancel={onClose}
        onSavingChange={setIsSaving}
        onSave={async (data) => {
          await onSave(data);
          onClose();
        }}
      />
    </Dialog>
  );
}
