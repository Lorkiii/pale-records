// Owns the shared add/edit class form, validation, submission, and modal lifecycle.
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { ClassApiError, createClass, updateClass } from '../classes-api';
import type {
  ClassRecord,
  ClassScalarFieldName,
  CreateClassInput,
} from '../class-types';
import { ClassScheduleFields } from './ClassScheduleFields';
import {
  type ClassScheduleFormRow,
  type ClassScheduleRowErrors,
  toClassScheduleInputs,
  validateClassScheduleRows,
} from '../class-schedule-form';

interface ClassFormDialogProps {
  isOpen: boolean;
  classRecord?: ClassRecord;
  newClassDefaults?: {
    schoolYear?: string;
    semester?: string;
  };
  onClose: () => void;
  onSaved: (savedClass: ClassRecord) => void;
  onSessionExpired: () => void;
}

type ClassFormValues = Record<ClassScalarFieldName, string>;
type ClassFormErrors = Partial<Record<ClassScalarFieldName | 'schedules' | 'form', string>>;

const EMPTY_FORM: ClassFormValues = {
  subjectName: '',
  subjectCode: '',
  section: '',
  schoolYear: '',
  semester: '',
  teacher: '',
  room: '',
  startDate: '',
  endDate: '',
};

const FIELD_LIMITS: Partial<Record<ClassScalarFieldName, number>> = {
  subjectName: 120,
  subjectCode: 32,
  section: 64,
  schoolYear: 32,
  semester: 32,
  teacher: 120,
  room: 64,
};

const CLASS_FIELDS = Object.keys(EMPTY_FORM) as ClassScalarFieldName[];

// Initializes edits only from their record and applies optional defaults only to new forms.
function getInitialValues(
  classRecord?: ClassRecord,
  newClassDefaults?: ClassFormDialogProps['newClassDefaults'],
): ClassFormValues {
  if (classRecord) {
    return {
      subjectName: classRecord.subjectName,
      subjectCode: classRecord.subjectCode ?? '',
      section: classRecord.section ?? '',
      schoolYear: classRecord.schoolYear ?? '',
      semester: classRecord.semester ?? '',
      teacher: classRecord.teacher ?? '',
      room: classRecord.room ?? '',
      startDate: classRecord.startDate ?? '',
      endDate: classRecord.endDate ?? '',
    };
  }

  return {
    ...EMPTY_FORM,
    schoolYear: newClassDefaults?.schoolYear ?? '',
    semester: newClassDefaults?.semester ?? '',
  };
}

// Converts saved schedules into stable local rows without exposing keys to the API.
function getInitialScheduleRows(classRecord?: ClassRecord): ClassScheduleFormRow[] {
  return classRecord?.schedules.map((schedule) => ({
    key: schedule.id,
    dayOfWeek: String(schedule.dayOfWeek),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  })) ?? [];
}

// Applies immediate form rules before a class request reaches the server.
function validateForm(values: ClassFormValues) {
  const errors: ClassFormErrors = {};

  if (!values.subjectName.trim()) {
    errors.subjectName = 'Subject name is required';
  }

  for (const field of CLASS_FIELDS) {
    const limit = FIELD_LIMITS[field];
    if (limit && values[field].trim().length > limit) {
      errors[field] = `Must be at most ${limit} characters`;
    }
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'End date must be on or after the start date';
  }

  return errors;
}

// Normalizes controlled form strings into the class API input contract.
function toCreateClassInput(
  values: ClassFormValues,
  scheduleRows: ClassScheduleFormRow[],
): CreateClassInput {
  // Omits blank optional values so the server can normalize them consistently.
  const optionalValue = (value: string) => value.trim() || undefined;

  return {
    subjectName: values.subjectName.trim(),
    subjectCode: optionalValue(values.subjectCode),
    section: optionalValue(values.section),
    schoolYear: optionalValue(values.schoolYear),
    semester: optionalValue(values.semester),
    teacher: optionalValue(values.teacher),
    room: optionalValue(values.room),
    startDate: optionalValue(values.startDate),
    endDate: optionalValue(values.endDate),
    schedules: toClassScheduleInputs(scheduleRows),
  };
}

// Maps server validation details back to the matching class form fields.
function readApiFieldErrors(error: ClassApiError) {
  const errors: ClassFormErrors = {};

  for (const field of CLASS_FIELDS) {
    const message = error.fieldErrors[field]?.[0];
    if (message) {
      errors[field] = message;
    }
  }

  const schedulesMessage = error.fieldErrors.schedules?.[0];
  if (schedulesMessage) {
    errors.schedules = schedulesMessage;
  }

  return errors;
}

// Renders and coordinates the shared add/edit class form lifecycle.
export function ClassFormDialog({
  isOpen,
  classRecord,
  newClassDefaults,
  onClose,
  onSaved,
  onSessionExpired,
}: ClassFormDialogProps) {
  const isEditing = Boolean(classRecord);
  const [values, setValues] = useState<ClassFormValues>(() =>
    getInitialValues(classRecord, newClassDefaults)
  );
  const [scheduleRows, setScheduleRows] = useState<ClassScheduleFormRow[]>(
    () => getInitialScheduleRows(classRecord),
  );
  const [scheduleRowErrors, setScheduleRowErrors] = useState<Record<string, ClassScheduleRowErrors>>({});
  const [errors, setErrors] = useState<ClassFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Updates one controlled field and clears errors made stale by the new value.
  const updateField = (field: ClassScalarFieldName) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: event.target.value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }));
  };

  // Replaces local schedule rows and clears validation made stale by the edit.
  const updateScheduleRows = (rows: ClassScheduleFormRow[]) => {
    setScheduleRows(rows);
    setScheduleRowErrors({});
    setErrors((currentErrors) => ({
      ...currentErrors,
      schedules: undefined,
      form: undefined,
    }));
  };

  // Prevents the dialog from closing while a class write is still in progress.
  const resetAndClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  // Validates the form, selects create or update, and reports the saved class upstream.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    const scheduleValidation = validateClassScheduleRows(scheduleRows);
    if (scheduleValidation.sectionError) {
      nextErrors.schedules = scheduleValidation.sectionError;
    }
    setErrors(nextErrors);
    setScheduleRowErrors(scheduleValidation.rowErrors);

    if (
      Object.keys(nextErrors).length > 0 ||
      Object.keys(scheduleValidation.rowErrors).length > 0
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const input = toCreateClassInput(values, scheduleRows);
      const savedClass = classRecord
        ? await updateClass(classRecord.id, input)
        : await createClass(input);
      onSaved(savedClass);
    } catch (error) {
      if (error instanceof ClassApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrors({
        ...(error instanceof ClassApiError ? readApiFieldErrors(error) : {}),
        form: error instanceof Error
          ? error.message
          : `Unable to ${isEditing ? 'update' : 'add'} the class. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={resetAndClose}
      title={isEditing ? 'Edit class' : 'Add class'}
      description={isEditing
        ? 'Update the academic and scheduling details recorded for this class.'
        : 'Enter the academic and scheduling details available for this class.'}
      isDismissDisabled={isSubmitting}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" isLoading={isSubmitting}>
            {isSubmitting
              ? `${isEditing ? 'Saving' : 'Adding'} class`
              : isEditing ? 'Save changes' : 'Add class'}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit} noValidate>
        {errors.form ? (
          <Notice variant="error" title={isEditing ? 'Class not updated' : 'Class not added'} className="mb-5">
            {errors.form}
          </Notice>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="class-subject-name"
            label="Subject name"
            required
            autoFocus
            value={values.subjectName}
            onChange={updateField('subjectName')}
            error={errors.subjectName}
            maxLength={120}
            autoComplete="off"
            wrapperClassName="sm:col-span-2"
          />
          <Input
            id="class-subject-code"
            label="Subject code"
            optional
            value={values.subjectCode}
            onChange={updateField('subjectCode')}
            error={errors.subjectCode}
            maxLength={32}
            autoComplete="off"
            isMonospace
          />
          <Input
            id="class-section"
            label="Section"
            optional
            value={values.section}
            onChange={updateField('section')}
            error={errors.section}
            maxLength={64}
            autoComplete="off"
          />
          <Input
            id="class-school-year"
            label="School year"
            optional
            value={values.schoolYear}
            onChange={updateField('schoolYear')}
            error={errors.schoolYear}
            maxLength={32}
            placeholder="e.g. 2026-2027"
            autoComplete="off"
            isMonospace
          />
          <Input
            id="class-semester"
            label="Semester"
            optional
            value={values.semester}
            onChange={updateField('semester')}
            error={errors.semester}
            maxLength={32}
            autoComplete="off"
          />
          <Input
            id="class-teacher"
            label="Teacher"
            optional
            value={values.teacher}
            onChange={updateField('teacher')}
            error={errors.teacher}
            maxLength={120}
            autoComplete="off"
          />
          <Input
            id="class-room"
            label="Room"
            optional
            value={values.room}
            onChange={updateField('room')}
            error={errors.room}
            maxLength={64}
            autoComplete="off"
          />
          <Input
            id="class-start-date"
            label="Start date"
            optional
            type="date"
            value={values.startDate}
            onChange={updateField('startDate')}
            error={errors.startDate}
            isMonospace
          />
          <Input
            id="class-end-date"
            label="End date"
            optional
            type="date"
            value={values.endDate}
            onChange={updateField('endDate')}
            error={errors.endDate}
            min={values.startDate || undefined}
            isMonospace
          />
        </div>

        <div className="mt-6">
          <ClassScheduleFields
            rows={scheduleRows}
            rowErrors={scheduleRowErrors}
            sectionError={errors.schedules}
            disabled={isSubmitting}
            onRowsChange={updateScheduleRows}
          />
        </div>
      </form>
    </Dialog>
  );
}
