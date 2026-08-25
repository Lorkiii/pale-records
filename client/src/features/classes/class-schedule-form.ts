// Defines and validates the Class form's local-only weekly schedule rows.
import {
  CLASS_WEEKDAYS,
  type ClassScheduleInput,
  type ClassWeekday,
} from './class-types';

export interface ClassScheduleFormRow {
  key: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface ClassScheduleRowErrors {
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
}

export interface ClassScheduleValidationResult {
  rowErrors: Record<string, ClassScheduleRowErrors>;
  sectionError?: string;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAY_VALUES = new Set(CLASS_WEEKDAYS.map((weekday) => String(weekday.value)));

// Resolves a validated form value to the matching ISO weekday union member.
function toClassWeekday(value: string): ClassWeekday {
  const weekday = CLASS_WEEKDAYS.find((option) => String(option.value) === value);

  if (!weekday) {
    throw new Error('Cannot convert an invalid Class schedule weekday');
  }

  return weekday.value;
}

// Keeps valid weekday rows ordered and leaves incomplete rows at the end.
export function sortClassScheduleRows(rows: ClassScheduleFormRow[]) {
  return [...rows].sort((first, second) => {
    const firstDay = Number(first.dayOfWeek) || 8;
    const secondDay = Number(second.dayOfWeek) || 8;
    return firstDay - secondDay;
  });
}

// Applies detailed row rules before schedule values are sent to the API.
export function validateClassScheduleRows(
  rows: ClassScheduleFormRow[],
): ClassScheduleValidationResult {
  const rowErrors: Record<string, ClassScheduleRowErrors> = {};
  const keysByWeekday = new Map<string, string[]>();

  for (const row of rows) {
    const errors: ClassScheduleRowErrors = {};

    if (!row.dayOfWeek) {
      errors.dayOfWeek = 'Weekday is required';
    } else if (!WEEKDAY_VALUES.has(row.dayOfWeek)) {
      errors.dayOfWeek = 'Select a valid weekday';
    } else {
      keysByWeekday.set(row.dayOfWeek, [
        ...(keysByWeekday.get(row.dayOfWeek) ?? []),
        row.key,
      ]);
    }

    if (!row.startTime) {
      errors.startTime = 'Start time is required';
    } else if (!TIME_PATTERN.test(row.startTime)) {
      errors.startTime = 'Use the HH:mm time format';
    }

    if (!row.endTime) {
      errors.endTime = 'End time is required';
    } else if (!TIME_PATTERN.test(row.endTime)) {
      errors.endTime = 'Use the HH:mm time format';
    } else if (
      TIME_PATTERN.test(row.startTime) &&
      row.endTime <= row.startTime
    ) {
      errors.endTime = 'End time must be later than start time';
    }

    if (Object.keys(errors).length > 0) {
      rowErrors[row.key] = errors;
    }
  }

  for (const duplicateKeys of keysByWeekday.values()) {
    if (duplicateKeys.length > 1) {
      for (const key of duplicateKeys) {
        rowErrors[key] = {
          ...rowErrors[key],
          dayOfWeek: 'Each weekday can be scheduled only once',
        };
      }
    }
  }

  return {
    rowErrors,
    sectionError: rows.length > 7
      ? 'A class can have at most seven weekly schedule rows'
      : undefined,
  };
}

// Removes local row keys and returns normalized weekday-sorted API input.
export function toClassScheduleInputs(rows: ClassScheduleFormRow[]) {
  return sortClassScheduleRows(rows).map((row): ClassScheduleInput => ({
    dayOfWeek: toClassWeekday(row.dayOfWeek),
    startTime: row.startTime,
    endTime: row.endTime,
  }));
}
