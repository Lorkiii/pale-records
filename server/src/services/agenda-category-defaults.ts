// Owns the six canonical Agenda category templates used by initialization and restore.
import {
  AgendaCategoryAccentKey,
  AgendaCategoryDefaultKey,
} from "../generated/prisma/client.js";

export const AGENDA_CATEGORY_DEFAULTS = [
  {
    defaultKey: AgendaCategoryDefaultKey.EXAM,
    name: "Examination",
    shortCode: "EXAM",
    accentKey: AgendaCategoryAccentKey.SIGNAL_RED,
    description: "Major examinations, midterms, and finals.",
  },
  {
    defaultKey: AgendaCategoryDefaultKey.ASSIGNMENT,
    name: "Assignment / Deadline",
    shortCode: "DEADLINE",
    accentKey: AgendaCategoryAccentKey.SIGNAL_AMBER,
    description: "Problem sets, essays, project submissions, and homework.",
  },
  {
    defaultKey: AgendaCategoryDefaultKey.ACTIVITY,
    name: "Class Activity",
    shortCode: "ACTIVITY",
    accentKey: AgendaCategoryAccentKey.SIGNAL_BLUE,
    description: "Recitations, laboratory work, presentations, and group discussions.",
  },
  {
    defaultKey: AgendaCategoryDefaultKey.HOLIDAY,
    name: "Academic Holiday",
    shortCode: "HOLIDAY",
    accentKey: AgendaCategoryAccentKey.SIGNAL_EMERALD,
    description: "Institutional breaks, national holidays, and official non-working days.",
  },
  {
    defaultKey: AgendaCategoryDefaultKey.MEETING,
    name: "Faculty Meeting",
    shortCode: "MEETING",
    accentKey: AgendaCategoryAccentKey.INK,
    description: "Departmental meetings, college assemblies, and committee work.",
  },
  {
    defaultKey: AgendaCategoryDefaultKey.NOTE,
    name: "General Note",
    shortCode: "NOTE",
    accentKey: AgendaCategoryAccentKey.INK_MUTED,
    description: "General academic reminders and notes.",
  },
] as const;

export function isReservedAgendaCategoryShortCode(
  shortCode: string,
  ownDefaultKey: AgendaCategoryDefaultKey | null = null,
) {
  return AGENDA_CATEGORY_DEFAULTS.some(
    (template) =>
      template.shortCode === shortCode && template.defaultKey !== ownDefaultKey,
  );
}
