// Provides modal form for scheduling and modifying academic events and milestones.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import {
  AGENDA_EVENT_TYPES,
  type AgendaEvent,
  type AgendaEventType,
  type CreateAgendaEventInput,
  type UpdateAgendaEventInput,
} from '../agenda-types';

interface AgendaEventFormProps {
  classes: ClassRecord[];
  initialDateKey: string;
  editingEvent: AgendaEvent | null;
  onCancel: () => void;
  onSave: (data: CreateAgendaEventInput | UpdateAgendaEventInput) => void;
}

function AgendaEventForm({
  classes,
  initialDateKey,
  editingEvent,
  onCancel,
  onSave,
}: AgendaEventFormProps) {
  const [title, setTitle] = useState(() => editingEvent?.title ?? '');
  const [eventType, setEventType] = useState<AgendaEventType>(
    () => editingEvent?.eventType ?? 'EXAM',
  );
  const [classId, setClassId] = useState<string>(() => editingEvent?.classId ?? 'NONE');
  const [eventDate, setEventDate] = useState(() => editingEvent?.eventDate ?? initialDateKey);
  const [isAllDay, setIsAllDay] = useState(() => editingEvent?.isAllDay ?? false);
  const [startTime, setStartTime] = useState(() => editingEvent?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(() => editingEvent?.endTime ?? '10:30');
  const [location, setLocation] = useState(() => editingEvent?.location ?? '');
  const [description, setDescription] = useState(() => editingEvent?.description ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-fill room when selecting a class if location is currently empty
  const handleClassChange = (selectedId: string) => {
    setClassId(selectedId);
    if (selectedId !== 'NONE' && !location.trim()) {
      const cls = classes.find((c) => c.id === selectedId);
      if (cls?.room) {
        setLocation(cls.room);
      }
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = 'Event title is required.';
    }

    if (!eventDate) {
      nextErrors.eventDate = 'Event date is required.';
    }

    if (!isAllDay && startTime && endTime && startTime >= endTime) {
      nextErrors.endTime = 'End time must be after start time.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      title: title.trim(),
      eventType,
      classId: classId === 'NONE' ? undefined : classId,
      eventDate,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const categoryOptions: SelectOption[] = AGENDA_EVENT_TYPES.map((t) => ({
    value: t.type,
    label: t.label,
  }));

  const classOptions: SelectOption[] = [
    { value: 'NONE', label: 'None (General / Personal Academic)' },
    ...classes.map((cls) => ({
      value: cls.id,
      label: cls.section
        ? `${cls.subjectName} (${cls.section})`
        : cls.subjectCode
          ? `${cls.subjectCode} - ${cls.subjectName}`
          : cls.subjectName,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <Input
        id="event-title"
        label="Event Title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Prelim Examination, Project Milestone 1"
        error={errors.title}
        isMonospace={false}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Category */}
        <Select
          id="event-category"
          label="Category"
          required
          value={eventType}
          onChange={(e) => setEventType(e.target.value as AgendaEventType)}
          options={categoryOptions}
        />

        {/* Linked Class */}
        <Select
          id="event-class"
          label="Associated Class"
          value={classId}
          onChange={(e) => handleClassChange(e.target.value)}
          options={classOptions}
        />
      </div>

      {/* Date & All-Day */}
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
        <Input
          id="event-date"
          type="date"
          label="Date"
          required
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          error={errors.eventDate}
          isMonospace
        />

        <div className="pb-3">
          <Checkbox
            id="event-all-day"
            label="All-Day Event"
            checked={isAllDay}
            onChange={(checked) => setIsAllDay(checked)}
          />
        </div>
      </div>

      {/* Start / End Time */}
      {!isAllDay && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="event-start-time"
            type="time"
            label="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            isMonospace
          />
          <Input
            id="event-end-time"
            type="time"
            label="End Time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            error={errors.endTime}
            isMonospace
          />
        </div>
      )}

      {/* Location / Room */}
      <Input
        id="event-location"
        label="Location / Room"
        optional
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g. Room 402, Computer Lab 1, Online"
        isMonospace
      />

      {/* Description / Notes */}
      <div>
        <Label htmlFor="event-description" optional>
          Agenda Notes & Coverage
        </Label>
        <textarea
          id="event-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Coverage topics, materials needed, submission links..."
          className="w-full resize-y rounded-none border border-neutral-400 bg-white p-3 font-sans text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        />
      </div>

      <div className="flex w-full items-center justify-end gap-3 pt-2">
        <Button variant="secondary" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="md" type="submit">
          {editingEvent ? 'Save Changes' : 'Schedule Event'}
        </Button>
      </div>
    </form>
  );
}

interface AgendaEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassRecord[];
  initialDateKey: string;
  editingEvent: AgendaEvent | null;
  onSave: (data: CreateAgendaEventInput | UpdateAgendaEventInput) => void;
}

export function AgendaEventDialog({
  isOpen,
  onClose,
  classes,
  initialDateKey,
  editingEvent,
  onSave,
}: AgendaEventDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingEvent ? 'Edit Agenda Event' : 'Add Agenda Event'}
      description={
        editingEvent
          ? 'Update the details or date for this academic milestone.'
          : 'Schedule a new milestone, exam, deadline, or reminder on this date.'
      }
    >
      <AgendaEventForm
        key={`${editingEvent?.id ?? 'new'}-${initialDateKey}`}
        classes={classes}
        initialDateKey={initialDateKey}
        editingEvent={editingEvent}
        onCancel={onClose}
        onSave={(data) => {
          onSave(data);
          onClose();
        }}
      />
    </Dialog>
  );
}
