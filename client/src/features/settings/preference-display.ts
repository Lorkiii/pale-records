// Centralizes preference-aware date, time, and data-density presentation styles.
import type { SystemPreferences } from './settings-types';

export type DateFormatPreference = SystemPreferences['dateFormat'];
export type TimeFormatPreference = SystemPreferences['timeFormat'];
export type TableDensityPreference = SystemPreferences['tableDensity'];

type DateFallbackStyle = 'long' | 'short';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const COMFORTABLE_DENSITY_CLASSES = {
  directoryGrid: 'gap-4',
  directoryRow: 'gap-5 p-5 sm:gap-6',
  surfaceHeader: 'px-5 py-4',
  surface: 'p-5',
  record: 'p-3.5 sm:p-4',
  stack: 'space-y-3',
  compactStack: 'space-y-2',
  metadataRow: 'pb-3',
  tableCell: 'px-3 py-3 md:px-4',
  tableInset: 'p-1.5',
  calendarCell: 'min-h-[96px] p-1.5 sm:min-h-[112px] sm:p-2',
} as const;

const COMPACT_DENSITY_CLASSES = {
  directoryGrid: 'gap-2',
  directoryRow: 'gap-3 p-3 sm:gap-4',
  surfaceHeader: 'px-4 py-3',
  surface: 'p-3 sm:p-4',
  record: 'p-2.5 sm:p-3',
  stack: 'space-y-2',
  compactStack: 'space-y-1',
  metadataRow: 'pb-2',
  tableCell: 'px-2 py-2 md:px-3',
  tableInset: 'p-1',
  calendarCell: 'min-h-[80px] p-1 sm:min-h-[96px] sm:p-1.5',
} as const;

// Returns complete calendar components without constructing a UTC timestamp.
function readDateOnly(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maximumDay = new Date(year, month, 0).getDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= maximumDay
    ? { year, month, day }
    : null;
}

// Formats a stored YYYY-MM-DD value without changing its calendar date.
export function formatDateOnly(
  value: string,
  dateFormat?: DateFormatPreference,
  fallbackStyle: DateFallbackStyle = 'long',
) {
  const parts = readDateOnly(value);
  if (!parts) return value;

  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');

  if (dateFormat === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  if (dateFormat === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  if (dateFormat === 'MM/DD/YYYY') return `${month}/${day}/${year}`;

  return new Intl.DateTimeFormat(undefined, fallbackStyle === 'short'
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(parts.year, parts.month - 1, parts.day));
}

// Formats validated HH:mm display values while leaving stored values unchanged.
export function formatTime(
  value: string,
  timeFormat?: TimeFormatPreference,
  fallbackFormat: TimeFormatPreference = '24H',
) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return value;

  const hour = Number(match[1]);
  const minute = match[2];
  const selectedFormat = timeFormat ?? fallbackFormat;
  if (selectedFormat === '24H') {
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const period = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${minute} ${period}`;
}

// Keeps every supported data surface on one comfortable/compact style mapping.
export function getTableDensityClasses(tableDensity?: TableDensityPreference) {
  return tableDensity === 'COMPACT'
    ? COMPACT_DENSITY_CLASSES
    : COMFORTABLE_DENSITY_CLASSES;
}
