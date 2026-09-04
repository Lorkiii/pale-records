// Escapes individual Attendance CSV values for safe spreadsheet display.

// Neutralizes spreadsheet formulas and quotes one CSV field without losing its text.
export function escapeAttendanceCsvField(value: string) {
  const trimmedValue = value.trimStart();
  const spreadsheetSafeValue = /^[=+@]/.test(trimmedValue) || /^-(?=.)/.test(trimmedValue)
    ? `'${value}`
    : value;
  const escapedValue = spreadsheetSafeValue.replace(/"/g, '""');
  return /[",\r\n]/.test(spreadsheetSafeValue) ? `"${escapedValue}"` : escapedValue;
}
