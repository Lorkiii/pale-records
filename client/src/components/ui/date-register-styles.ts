// Keeps date-column sizing and selected/editing states consistent across registers.
export const DATE_REGISTER_COLUMN_CLASSES = 'w-20 min-w-20 sm:w-24 sm:min-w-24';

export function getDateRegisterColumnClasses(isSelected: boolean, isEditing: boolean) {
  if (!isSelected) {
    return {
      header: 'bg-paper-muted text-ink',
      cell: 'bg-paper-light',
      control: 'hover:bg-paper-dark',
    };
  }

  return {
    header: isEditing
      ? 'border-x-2 border-x-signal-blue bg-signal-blue text-paper-light'
      : 'border-x-2 border-x-ink bg-ink text-paper-light',
    cell: isEditing
      ? 'border-x-2 border-x-signal-blue bg-signal-blue/10'
      : 'border-x-2 border-x-ink bg-paper-muted',
    control: 'focus-visible:outline-paper-light focus-visible:-outline-offset-4',
  };
}
