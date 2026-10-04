// Owns stable class color accents and the class labels used throughout Agenda.
import type { ClassRecord } from '../classes/class-types';

// Keep this palette order fixed: class IDs map to the same color on every device.
const CLASS_COLOR_PALETTE = [
  { pipColor: 'bg-signal-blue', surfaceStyle: 'border-signal-blue bg-signal-blue/10' },
  { pipColor: 'bg-signal-emerald', surfaceStyle: 'border-signal-emerald bg-signal-emerald/10' },
  { pipColor: 'bg-signal-purple', surfaceStyle: 'border-signal-purple bg-signal-purple/10' },
  { pipColor: 'bg-signal-orange', surfaceStyle: 'border-signal-orange bg-signal-orange/10' },
  { pipColor: 'bg-signal-rose', surfaceStyle: 'border-signal-rose bg-signal-rose/10' },
  { pipColor: 'bg-signal-teal', surfaceStyle: 'border-signal-teal bg-signal-teal/10' },
  { pipColor: 'bg-signal-gold', surfaceStyle: 'border-signal-gold bg-signal-gold/10' },
  { pipColor: 'bg-signal-red', surfaceStyle: 'border-signal-red bg-signal-red/10' },
] as const;

export function getAgendaClassColor(classId: string) {
  let hash = 2166136261;
  for (let index = 0; index < classId.length; index++) {
    hash = Math.imul(hash ^ classId.charCodeAt(index), 16777619);
  }
  return CLASS_COLOR_PALETTE[(hash >>> 0) % CLASS_COLOR_PALETTE.length];
}

export function formatAgendaClassLabel(
  classRecord: Pick<ClassRecord, 'subjectName' | 'subjectCode' | 'section'>,
) {
  const subject = classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;
  return classRecord.section ? `${subject} · Sec ${classRecord.section}` : subject;
}
