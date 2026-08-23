// Owns the UI-only add-student form, schema-aligned validation, and reusable modal composition.
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import type { StudentFieldName, StudentInput } from '../student-types';

interface StudentFormDialogProps {
  isOpen: boolean;
  classes: ClassRecord[];
  onClose: () => void;
  onAdd: (student: StudentInput) => void;
}

type StudentFormValues = Record<StudentFieldName, string>;
type StudentFormErrors = Partial<Record<StudentFieldName, string>>;

const EMPTY_FORM: StudentFormValues = {
  classId: '',
  studentNo: '',
  firstName: '',
  lastName: '',
};

// Builds a concise class label from real fields already available in the class directory.
function getClassOptionLabel(classRecord: ClassRecord) {
  const subject = classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;

  return classRecord.section ? `${subject} / ${classRecord.section}` : subject;
}

// Applies only the required-field rules expressed by the current Prisma Student model.
function validateForm(values: StudentFormValues) {
  const errors: StudentFormErrors = {};

  if (!values.classId) {
    errors.classId = 'Class is required';
  }

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }

  return errors;
}

// Normalizes controlled form strings into the editable Student model fields.
function toStudentInput(values: StudentFormValues): StudentInput {
  return {
    classId: values.classId,
    studentNo: values.studentNo.trim() || null,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
}

// Renders the add-student fields inside the shared accessible Dialog primitive.
export function StudentFormDialog({
  isOpen,
  classes,
  onClose,
  onAdd,
}: StudentFormDialogProps) {
  const [values, setValues] = useState<StudentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<StudentFormErrors>({});

  const classOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Select a class', disabled: true },
      ...classes.map((classRecord) => ({
        value: classRecord.id,
        label: getClassOptionLabel(classRecord),
      })),
    ],
    [classes],
  );

  // Updates one controlled field and clears its stale validation message.
  const updateField = (field: StudentFieldName) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: event.target.value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  };

  // Validates and returns the student values to the page without making a server request.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onAdd(toStudentInput(values));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add student"
      description="Enter the student identity and select the class this record belongs to."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="student-form">
            Add student
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            id="student-class"
            label="Class"
            required
            autoFocus
            value={values.classId}
            onChange={updateField('classId')}
            error={errors.classId}
            options={classOptions}
            wrapperClassName="sm:col-span-2"
          />
          <Input
            id="student-first-name"
            label="First name"
            required
            value={values.firstName}
            onChange={updateField('firstName')}
            error={errors.firstName}
            autoComplete="given-name"
          />
          <Input
            id="student-last-name"
            label="Last name"
            required
            value={values.lastName}
            onChange={updateField('lastName')}
            error={errors.lastName}
            autoComplete="family-name"
          />
          <Input
            id="student-number"
            label="Student number"
            optional
            value={values.studentNo}
            onChange={updateField('studentNo')}
            autoComplete="off"
            isMonospace
            wrapperClassName="sm:col-span-2"
          />
        </div>
      </form>
    </Dialog>
  );
}
