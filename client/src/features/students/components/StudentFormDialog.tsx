// Owns multi-class student validation, persistence, and accessible modal composition.
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import { createStudent, StudentApiError } from '../students-api';
import type {
  CreateStudentInput,
  StudentRecord,
  StudentTextFieldName,
} from '../student-types';

interface StudentFormDialogProps {
  isOpen: boolean;
  classes: ClassRecord[];
  onClose: () => void;
  onSaved: (student: StudentRecord) => void;
  onSessionExpired: () => void;
}

type StudentFormValues = Record<StudentTextFieldName, string> & {
  classIds: string[];
};

type StudentFormErrors = Partial<
  Record<StudentTextFieldName | 'classIds' | 'form', string>
>;

const EMPTY_FORM: StudentFormValues = {
  classIds: [],
  studentNo: '',
  firstName: '',
  lastName: '',
};

const STUDENT_TEXT_FIELDS: StudentTextFieldName[] = [
  'studentNo',
  'firstName',
  'lastName',
];

// Builds a concise label from real class fields already available to the form.
function getClassLabel(classRecord: ClassRecord) {
  return classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;
}

// Applies immediate form rules before a student request reaches the server.
function validateForm(values: StudentFormValues) {
  const errors: StudentFormErrors = {};

  if (values.classIds.length === 0) {
    errors.classIds = 'Select at least one class';
  }

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required';
  } else if (values.firstName.trim().length > 120) {
    errors.firstName = 'First name must be at most 120 characters';
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required';
  } else if (values.lastName.trim().length > 120) {
    errors.lastName = 'Last name must be at most 120 characters';
  }

  if (values.studentNo.trim().length > 64) {
    errors.studentNo = 'Student number must be at most 64 characters';
  }

  return errors;
}

// Normalizes controlled values into the student creation API contract.
function toCreateStudentInput(values: StudentFormValues): CreateStudentInput {
  const studentNo = values.studentNo.trim().toUpperCase();

  return {
    classIds: values.classIds,
    studentNo: studentNo || undefined,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
}

// Maps server validation details back to fields rendered by this form.
function readApiFieldErrors(error: StudentApiError) {
  const errors: StudentFormErrors = {};

  for (const field of STUDENT_TEXT_FIELDS) {
    const message = error.fieldErrors[field]?.[0];
    if (message) {
      errors[field] = message;
    }
  }

  const classMessage = error.fieldErrors.classIds?.[0];
  if (classMessage) {
    errors.classIds = classMessage;
  }

  return errors;
}

// Renders and coordinates the persisted add-student form lifecycle.
export function StudentFormDialog({
  isOpen,
  classes,
  onClose,
  onSaved,
  onSessionExpired,
}: StudentFormDialogProps) {
  const [values, setValues] = useState<StudentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<StudentFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Updates one identity field and clears errors made stale by the new value.
  const updateField = (field: StudentTextFieldName) => (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
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

  // Toggles one class assignment while retaining every other selection.
  const toggleClass = (classId: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      classIds: currentValues.classIds.includes(classId)
        ? currentValues.classIds.filter((selectedId) => selectedId !== classId)
        : [...currentValues.classIds, classId],
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      classIds: undefined,
      form: undefined,
    }));
  };

  // Prevents the dialog from closing while its database write is in progress.
  const resetAndClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Validates, persists, and reports the saved student to the directory.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const student = await createStudent(toCreateStudentInput(values));
      onSaved(student);
    } catch (error) {
      if (error instanceof StudentApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrors({
        ...(error instanceof StudentApiError ? readApiFieldErrors(error) : {}),
        form: error instanceof Error
          ? error.message
          : 'Unable to add the student. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Add student"
      description="Enter the student identity and select every active class they attend."
      isDismissDisabled={isSubmitting}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" isLoading={isSubmitting}>
            {isSubmitting ? 'Adding student' : 'Add student'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} noValidate>
        {errors.form ? (
          <Notice variant="error" title="Student not added" className="mb-5">
            {errors.form}
          </Notice>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset
            className="sm:col-span-2"
            aria-describedby={errors.classIds ? 'student-classes-error' : 'student-classes-hint'}
            aria-invalid={Boolean(errors.classIds)}
          >
            <legend className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
              Classes <span className="text-signal-red">*</span>
            </legend>
            <p id="student-classes-hint" className="mb-3 text-sm leading-6 text-ink-muted">
              Select every class for this student. You can choose more than one.
            </p>
            <div className="grid max-h-64 overflow-y-auto border border-paper-border bg-paper-light sm:grid-cols-2">
              {classes.map((classRecord, index) => {
                const checkboxId = `student-class-${classRecord.id}`;
                const metadata = [classRecord.section, classRecord.schoolYear]
                  .filter(Boolean)
                  .join(' / ');

                return (
                  <label
                    key={classRecord.id}
                    htmlFor={checkboxId}
                    className="flex min-h-16 cursor-pointer items-start gap-3 border-b border-paper-border p-3 hover:bg-paper-muted sm:[&:nth-child(odd)]:border-r"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={values.classIds.includes(classRecord.id)}
                      onChange={() => toggleClass(classRecord.id)}
                      disabled={isSubmitting}
                      autoFocus={index === 0}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-ink">
                        {getClassLabel(classRecord)}
                      </span>
                      {metadata ? (
                        <span className="mt-1 block break-words font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                          {metadata}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.classIds ? (
              <p id="student-classes-error" className="mt-1 flex items-center gap-1 font-mono text-xs text-signal-red">
                <span aria-hidden="true">/!/</span>
                <span>{errors.classIds}</span>
              </p>
            ) : null}
          </fieldset>

          <Input
            id="student-first-name"
            label="First name"
            required
            value={values.firstName}
            onChange={updateField('firstName')}
            error={errors.firstName}
            maxLength={120}
            autoComplete="given-name"
          />
          <Input
            id="student-last-name"
            label="Last name"
            required
            value={values.lastName}
            onChange={updateField('lastName')}
            error={errors.lastName}
            maxLength={120}
            autoComplete="family-name"
          />
          <Input
            id="student-number"
            label="Student number"
            optional
            value={values.studentNo}
            onChange={updateField('studentNo')}
            error={errors.studentNo}
            maxLength={64}
            hint="Stored in uppercase when provided."
            autoComplete="off"
            isMonospace
            wrapperClassName="sm:col-span-2"
          />
        </div>
      </form>
    </Dialog>
  );
}
