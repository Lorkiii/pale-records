// Owns the credentialed Dashboard overview request and exact runtime response validation.
import type { AgendaCategoryAccentKey } from '../agenda/agenda-types';
import type {
  DashboardAttendanceStatus,
  DashboardClassSummary,
  DashboardOverviewData,
  DashboardRecentUpdate,
  DashboardRecentUpdateType,
  DashboardTodaySession,
  DashboardUpcomingEvent,
  DashboardWeekdayName,
  DashboardWeeklyAttendance,
  DashboardWeeklyAttendanceDay,
} from './dashboard-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SHORT_CODE_PATTERN = /^[A-Z0-9_-]{1,12}$/;
const DASHBOARD_MIN_YEAR = 2000;
const DASHBOARD_MAX_YEAR = 2100;
const DASHBOARD_MAX_TODAY_SESSIONS = 100;
const DASHBOARD_MAX_UPCOMING_EVENTS = 6;
const DASHBOARD_MAX_CLASS_SUMMARIES = 100;
const DASHBOARD_MAX_RECENT_UPDATES = 6;
const DASHBOARD_WEEKDAYS: DashboardWeekdayName[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DASHBOARD_RATE_TOTAL_TENTHS = 1_000;
const DASHBOARD_RATE_ROUNDING_TOLERANCE_TENTHS = 2;

export type DashboardApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'MALFORMED_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_SERVER_ERROR'
  | 'DASHBOARD_CLIENT_INPUT_INVALID'
  | 'DASHBOARD_REQUEST_FAILED';

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

// Carries safe HTTP and validation context to the Dashboard loading workflow.
export class DashboardApiError extends Error {
  status: number;
  code: DashboardApiErrorCode;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];

  constructor(
    message: string,
    status: number,
    code: DashboardApiErrorCode = 'DASHBOARD_REQUEST_FAILED',
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'DashboardApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors ?? {};
    this.formErrors = details?.formErrors ?? [];
  }
}

// Narrows untrusted JSON to a property container before reading any value.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Rejects missing and additional keys at every public response level.
function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).toSorted();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

// Validates a real date-only value without applying the browser timezone.
function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Limits request dates to the same range accepted by the server boundary.
function isDashboardRequestDate(value: string) {
  const year = Number(value.slice(0, 4));
  return isDateOnly(value) && year >= DASHBOARD_MIN_YEAR && year <= DASHBOARD_MAX_YEAR;
}

// Converts an already validated date-only string to stable UTC milliseconds.
function getDateOnlyUtcTime(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isOneDecimalNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= minimum && value <= maximum &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

function isPercentage(value: unknown): value is number {
  return isOneDecimalNumber(value, 0, 100);
}

function isNullablePercentage(value: unknown): value is number | null {
  return value === null || isPercentage(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && UUID_PATTERN.test(value);
}

function isNullableText(value: unknown, maximum: number): value is string | null {
  return value === null || typeof value === 'string' &&
    value.trim().length > 0 && value.length <= maximum;
}

function isAttendanceStatus(value: unknown): value is DashboardAttendanceStatus {
  return value === 'optimal' || value === 'moderate' || value === 'at-risk';
}

function getAttendanceStatus(presentRate: number): DashboardAttendanceStatus {
  if (presentRate >= 90) return 'optimal';
  if (presentRate >= 80) return 'moderate';
  return 'at-risk';
}

function calculatePresentRate(presentCount: number, totalMarked: number) {
  return totalMarked === 0 ? null : Math.round((presentCount / totalMarked) * 1000) / 10;
}

function isAccentKey(value: unknown): value is AgendaCategoryAccentKey {
  return value === 'SIGNAL_RED' || value === 'SIGNAL_ORANGE' ||
    value === 'SIGNAL_AMBER' || value === 'SIGNAL_YELLOW' ||
    value === 'SIGNAL_GOLD' || value === 'SIGNAL_OCHRE' ||
    value === 'SIGNAL_MUSTARD' || value === 'SIGNAL_EMERALD' ||
    value === 'SIGNAL_TEAL' || value === 'SIGNAL_BLUE' ||
    value === 'SIGNAL_PURPLE' || value === 'SIGNAL_ROSE' ||
    value === 'INK' || value === 'INK_MUTED';
}

function isRecentUpdateType(value: unknown): value is DashboardRecentUpdateType {
  return value === 'attendance' || value === 'recitation' ||
    value === 'agenda' || value === 'class' || value === 'student';
}

function isDashboardKpis(value: unknown) {
  return isRecord(value) && hasExactKeys(value, [
    'overallPresentRate',
    'changeVsPreviousMonth',
    'enrolledStudentCount',
    'activeClassCount',
    'upcomingEventCount',
  ]) &&
    isNullablePercentage(value.overallPresentRate) &&
    (value.changeVsPreviousMonth === null ||
      isOneDecimalNumber(value.changeVsPreviousMonth, -100, 100)) &&
    !(value.overallPresentRate === null && value.changeVsPreviousMonth !== null) &&
    isNonnegativeInteger(value.enrolledStudentCount) &&
    isNonnegativeInteger(value.activeClassCount) &&
    isNonnegativeInteger(value.upcomingEventCount);
}

function isTodaySession(value: unknown): value is DashboardTodaySession {
  return isRecord(value) && hasExactKeys(value, [
    'id',
    'classId',
    'subjectCode',
    'subjectName',
    'section',
    'room',
    'startTime',
    'endTime',
    'enrolledCount',
    'attendanceCompleted',
  ]) &&
    typeof value.id === 'string' && UUID_PATTERN.test(value.id) &&
    typeof value.classId === 'string' && UUID_PATTERN.test(value.classId) &&
    isNullableText(value.subjectCode, 32) &&
    typeof value.subjectName === 'string' &&
    value.subjectName.trim().length > 0 && value.subjectName.length <= 120 &&
    isNullableText(value.section, 64) &&
    isNullableText(value.room, 64) &&
    typeof value.startTime === 'string' && TIME_PATTERN.test(value.startTime) &&
    typeof value.endTime === 'string' && TIME_PATTERN.test(value.endTime) &&
    value.endTime > value.startTime &&
    isNonnegativeInteger(value.enrolledCount) &&
    typeof value.attendanceCompleted === 'boolean';
}

function isUpcomingEvent(value: unknown): value is DashboardUpcomingEvent {
  return isRecord(value) && hasExactKeys(value, [
    'id', 'title', 'category', 'eventDate', 'startTime', 'isCompleted',
  ]) &&
    typeof value.id === 'string' && UUID_PATTERN.test(value.id) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 && value.title.length <= 160 &&
    isRecord(value.category) &&
    hasExactKeys(value.category, ['shortCode', 'accentKey']) &&
    typeof value.category.shortCode === 'string' &&
    SHORT_CODE_PATTERN.test(value.category.shortCode) &&
    isAccentKey(value.category.accentKey) &&
    isDateOnly(value.eventDate) &&
    (value.startTime === null ||
      typeof value.startTime === 'string' && TIME_PATTERN.test(value.startTime)) &&
    typeof value.isCompleted === 'boolean';
}

function isClassSummary(value: unknown): value is DashboardClassSummary {
  if (!isRecord(value) || !hasExactKeys(value, [
    'classId',
    'subjectCode',
    'subjectName',
    'section',
    'enrolledCount',
    'presentRate',
    'lateRate',
    'absentRate',
    'excusedRate',
    'status',
  ]) ||
    typeof value.classId !== 'string' || !UUID_PATTERN.test(value.classId) ||
    !isNullableText(value.subjectCode, 32) ||
    typeof value.subjectName !== 'string' ||
    value.subjectName.trim().length === 0 || value.subjectName.length > 120 ||
    !isNullableText(value.section, 64) ||
    !isNonnegativeInteger(value.enrolledCount)) {
    return false;
  }

  const rates = [value.presentRate, value.lateRate, value.absentRate, value.excusedRate];
  if (rates.every((rate) => rate === null)) return value.status === null;
  if (!rates.every(isPercentage) || !isAttendanceStatus(value.status)) return false;

  const measuredRates = rates as number[];
  const totalRateTenths = measuredRates.reduce(
    (total, rate) => total + Math.round(rate * 10),
    0,
  );
  return Math.abs(totalRateTenths - DASHBOARD_RATE_TOTAL_TENTHS) <=
    DASHBOARD_RATE_ROUNDING_TOLERANCE_TENTHS &&
    value.status === getAttendanceStatus(value.presentRate as number);
}

function isWeeklyAttendanceDay(value: unknown): value is DashboardWeeklyAttendanceDay {
  if (!isRecord(value) || !hasExactKeys(value, [
    'dayName',
    'dateKey',
    'presentCount',
    'lateCount',
    'absentCount',
    'excusedCount',
    'totalMarked',
    'presentRate',
  ]) ||
    !DASHBOARD_WEEKDAYS.includes(value.dayName as DashboardWeekdayName) ||
    !isDateOnly(value.dateKey) ||
    !isNonnegativeInteger(value.presentCount) ||
    !isNonnegativeInteger(value.lateCount) ||
    !isNonnegativeInteger(value.absentCount) ||
    !isNonnegativeInteger(value.excusedCount) ||
    !isNonnegativeInteger(value.totalMarked) ||
    !isNullablePercentage(value.presentRate)) {
    return false;
  }

  const expectedTotal = value.presentCount + value.lateCount +
    value.absentCount + value.excusedCount;
  return value.totalMarked === expectedTotal &&
    value.presentRate === calculatePresentRate(value.presentCount, value.totalMarked);
}

function isWeeklyAttendance(value: unknown): value is DashboardWeeklyAttendance {
  if (!isRecord(value) || !hasExactKeys(value, ['days', 'averagePresentRate']) ||
    !Array.isArray(value.days) || value.days.length !== DASHBOARD_WEEKDAYS.length ||
    !value.days.every(isWeeklyAttendanceDay) ||
    !isNullablePercentage(value.averagePresentRate) ||
    !value.days.every((day, index) => day.dayName === DASHBOARD_WEEKDAYS[index])) {
    return false;
  }

  const presentCount = value.days.reduce((total, day) => total + day.presentCount, 0);
  const totalMarked = value.days.reduce((total, day) => total + day.totalMarked, 0);
  return value.averagePresentRate === calculatePresentRate(presentCount, totalMarked);
}

function isRecentUpdate(value: unknown): value is DashboardRecentUpdate {
  return isRecord(value) && hasExactKeys(value, [
    'entityId', 'type', 'title', 'description', 'occurredAt', 'classId', 'eventDate',
  ]) &&
    typeof value.entityId === 'string' && UUID_PATTERN.test(value.entityId) &&
    isRecentUpdateType(value.type) &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 && value.title.length <= 160 &&
    isNullableText(value.description, 500) &&
    typeof value.occurredAt === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value.occurredAt) &&
    !Number.isNaN(Date.parse(value.occurredAt)) &&
    isNullableUuid(value.classId) &&
    (value.eventDate === null || isDateOnly(value.eventDate));
}

// Confirms relative dates that depend on the requested overview anchor.
function hasValidOverviewDateWindows(overview: DashboardOverviewData) {
  const asOfTime = getDateOnlyUtcTime(overview.asOfDate);
  const asOfWeekday = new Date(asOfTime).getUTCDay() || 7;
  const weekStart = asOfTime - (asOfWeekday - 1) * 24 * 60 * 60 * 1000;
  const hasExpectedWeek = overview.weeklyAttendance.days.every((day, index) =>
    getDateOnlyUtcTime(day.dateKey) === weekStart + index * 24 * 60 * 60 * 1000);
  const upcomingEnd = asOfTime + 6 * 24 * 60 * 60 * 1000;
  const hasExpectedUpcomingEvents = overview.upcomingEvents.every((event) => {
    const eventTime = getDateOnlyUtcTime(event.eventDate);
    return eventTime >= asOfTime && eventTime <= upcomingEnd;
  });
  return hasExpectedWeek && hasExpectedUpcomingEvents;
}

// Selects the exact bounded read model from the shared success envelope.
function readDashboardOverview(data: Record<string, unknown>) {
  if (!hasExactKeys(data, [
    'asOfDate',
    'kpis',
    'todaySessions',
    'upcomingEvents',
    'classSummaries',
    'weeklyAttendance',
    'recentUpdates',
  ]) ||
    !isDateOnly(data.asOfDate) ||
    !isDashboardKpis(data.kpis) ||
    !Array.isArray(data.todaySessions) ||
    data.todaySessions.length > DASHBOARD_MAX_TODAY_SESSIONS ||
    !data.todaySessions.every(isTodaySession) ||
    !Array.isArray(data.upcomingEvents) ||
    data.upcomingEvents.length > DASHBOARD_MAX_UPCOMING_EVENTS ||
    !data.upcomingEvents.every(isUpcomingEvent) ||
    !Array.isArray(data.classSummaries) ||
    data.classSummaries.length > DASHBOARD_MAX_CLASS_SUMMARIES ||
    !data.classSummaries.every(isClassSummary) ||
    !isWeeklyAttendance(data.weeklyAttendance) ||
    !Array.isArray(data.recentUpdates) ||
    data.recentUpdates.length > DASHBOARD_MAX_RECENT_UPDATES ||
    !data.recentUpdates.every(isRecentUpdate)) {
    return undefined;
  }

  const overview = data as unknown as DashboardOverviewData;
  return hasValidOverviewDateWindows(overview) ? overview : undefined;
}

function isDashboardApiErrorCode(value: unknown): value is DashboardApiErrorCode {
  return value === 'VALIDATION_ERROR' || value === 'UNAUTHENTICATED' ||
    value === 'MALFORMED_JSON' || value === 'PAYLOAD_TOO_LARGE' ||
    value === 'INTERNAL_SERVER_ERROR';
}

function readStringArrays(value: unknown) {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.every((entry): entry is [string, string[]] =>
    Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'))) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function readErrorDetails(value: unknown): ErrorDetails | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ['fieldErrors', 'formErrors'])) {
    return undefined;
  }
  const fieldErrors = readStringArrays(value.fieldErrors);
  const formErrors = Array.isArray(value.formErrors) &&
    value.formErrors.every((item) => typeof item === 'string')
    ? value.formErrors
    : undefined;
  return fieldErrors && formErrors ? { fieldErrors, formErrors } : undefined;
}

// Converts an unsuccessful exact envelope into a safe feature error.
async function readApiError(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return new DashboardApiError('Unable to complete the Dashboard request.', response.status);
  }

  if (!isRecord(payload) || !hasExactKeys(payload, ['success', 'error']) ||
    payload.success !== false || !isRecord(payload.error)) {
    return new DashboardApiError('Unable to complete the Dashboard request.', response.status);
  }

  const errorKeys = Object.hasOwn(payload.error, 'details')
    ? ['code', 'message', 'details']
    : ['code', 'message'];
  if (!hasExactKeys(payload.error, errorKeys) ||
    !isDashboardApiErrorCode(payload.error.code) ||
    typeof payload.error.message !== 'string') {
    return new DashboardApiError('Unable to complete the Dashboard request.', response.status);
  }

  const details = Object.hasOwn(payload.error, 'details')
    ? readErrorDetails(payload.error.details)
    : undefined;
  if (Object.hasOwn(payload.error, 'details') && !details) {
    return new DashboardApiError('Unable to complete the Dashboard request.', response.status);
  }

  return new DashboardApiError(
    payload.error.message,
    response.status,
    payload.error.code,
    details,
  );
}

// Parses one exact success envelope before returning Dashboard data to page state.
async function readSuccessData(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new DashboardApiError('Unable to read the Dashboard overview.', response.status);
  }

  if (!isRecord(payload) || !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true || !isRecord(payload.data)) {
    throw new DashboardApiError('Unable to read the Dashboard overview.', response.status);
  }

  const overview = readDashboardOverview(payload.data);
  if (!overview) {
    throw new DashboardApiError('Unable to read the Dashboard overview.', response.status);
  }
  return overview;
}

// Loads one local-date Dashboard snapshot while preserving cancellable requests.
export async function fetchDashboardOverview(asOfDate: string, signal: AbortSignal) {
  if (!isDashboardRequestDate(asOfDate)) {
    throw new DashboardApiError(
      'Choose a valid Dashboard date.',
      0,
      'DASHBOARD_CLIENT_INPUT_INVALID',
    );
  }

  let response: Response;
  try {
    const query = new URLSearchParams({ date: asOfDate });
    response = await fetch(`/api/dashboard/overview?${query.toString()}`, {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new DashboardApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readApiError(response);
  return readSuccessData(response);
}
