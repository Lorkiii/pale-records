// Owns credentialed Agenda category requests and strict public response parsing.
import {
  AgendaApiError,
  handleNetworkError,
  hasExactKeys,
  isAgendaCategoryAccentKey,
  isRecord,
  readApiError,
  readSuccessData,
  UUID_PATTERN,
} from './agenda-api';
import type {
  AgendaCategory,
  AgendaCategoryInput,
  UpdateAgendaCategoryInput,
} from './agenda-types';

const MAX_AGENDA_CATEGORIES = 100;
const SHORT_CODE_PATTERN = /^[A-Z0-9_-]{1,12}$/;

function isAgendaCategory(value: unknown): value is AgendaCategory {
  return isRecord(value) && hasExactKeys(value, [
    'id', 'name', 'shortCode', 'accentKey', 'description', 'isDefault', 'isActive',
  ]) &&
    typeof value.id === 'string' && UUID_PATTERN.test(value.id) &&
    typeof value.name === 'string' && value.name.trim().length > 0 &&
    value.name.length <= 120 &&
    typeof value.shortCode === 'string' && SHORT_CODE_PATTERN.test(value.shortCode) &&
    isAgendaCategoryAccentKey(value.accentKey) &&
    (value.description === null ||
      typeof value.description === 'string' && value.description.length <= 500) &&
    typeof value.isDefault === 'boolean' &&
    typeof value.isActive === 'boolean';
}

function readCategories(data: Record<string, unknown>) {
  if (!hasExactKeys(data, ['categories']) ||
      !Array.isArray(data.categories) ||
      data.categories.length > MAX_AGENDA_CATEGORIES ||
      !data.categories.every(isAgendaCategory)) {
    return undefined;
  }
  const ids = data.categories.map((category) => category.id);
  return new Set(ids).size === ids.length ? data.categories : undefined;
}

function readCategory(data: Record<string, unknown>) {
  return hasExactKeys(data, ['category']) && isAgendaCategory(data.category)
    ? data.category
    : undefined;
}

function validateCategoryInput(input: AgendaCategoryInput | UpdateAgendaCategoryInput) {
  const name = input.name.trim();
  const shortCode = input.shortCode.trim().toUpperCase();
  const description = input.description?.trim() || null;
  const fieldErrors: Record<string, string[]> = {};

  if (name.length < 1 || name.length > 120) {
    fieldErrors.name = ['Category name is required and must be at most 120 characters.'];
  }
  if (!SHORT_CODE_PATTERN.test(shortCode)) {
    fieldErrors.shortCode = [
      'Short code must be 1 to 12 letters, numbers, hyphens, or underscores.',
    ];
  }
  if (description !== null && description.length > 500) {
    fieldErrors.description = ['Description must be at most 500 characters.'];
  }
  if (!isAgendaCategoryAccentKey(input.accentKey)) {
    fieldErrors.accentKey = ['Choose a valid semantic accent.'];
  }
  if ('isActive' in input && typeof input.isActive !== 'boolean') {
    fieldErrors.isActive = ['Choose a valid category status.'];
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new AgendaApiError(
      'Review the highlighted category fields.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
      { fieldErrors },
    );
  }

  return {
    name,
    shortCode,
    accentKey: input.accentKey,
    description,
    ...('isActive' in input ? { isActive: input.isActive } : {}),
  };
}

export async function fetchAgendaCategories(signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch('/api/agenda/categories', {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    handleNetworkError(error);
  }
  if (!response.ok) throw await readApiError(response);
  return readSuccessData(response, 'Unable to read Agenda categories.', readCategories);
}

export async function createAgendaCategory(input: AgendaCategoryInput) {
  const payload = validateCategoryInput(input);
  let response: Response;
  try {
    response = await fetch('/api/agenda/categories', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    handleNetworkError(error);
  }
  if (!response.ok) throw await readApiError(response);
  return readSuccessData(response, 'Unable to read the created category.', readCategory);
}

export async function updateAgendaCategory(
  categoryId: string,
  input: UpdateAgendaCategoryInput,
) {
  if (!UUID_PATTERN.test(categoryId)) {
    throw new AgendaApiError('Choose a valid Agenda category.', 400, 'AGENDA_CLIENT_INPUT_INVALID');
  }
  const payload = validateCategoryInput(input);
  let response: Response;
  try {
    response = await fetch(`/api/agenda/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    handleNetworkError(error);
  }
  if (!response.ok) throw await readApiError(response);
  const category = await readSuccessData(
    response,
    'Unable to read the updated category.',
    readCategory,
  );
  if (category.id !== categoryId) {
    throw new AgendaApiError('The updated category did not match the request.', response.status);
  }
  return category;
}

export async function deleteAgendaCategory(categoryId: string) {
  if (!UUID_PATTERN.test(categoryId)) {
    throw new AgendaApiError('Choose a valid Agenda category.', 400, 'AGENDA_CLIENT_INPUT_INVALID');
  }
  let response: Response;
  try {
    response = await fetch(`/api/agenda/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    handleNetworkError(error);
  }
  if (!response.ok) throw await readApiError(response);
  return readSuccessData(response, 'Unable to confirm the category change.', (data) => {
    if (!hasExactKeys(data, ['categoryId', 'result']) ||
        data.categoryId !== categoryId ||
        (data.result !== 'DELETED' && data.result !== 'DEACTIVATED')) {
      return undefined;
    }
    return data.result;
  });
}

export async function restoreDefaultAgendaCategories() {
  let response: Response;
  try {
    response = await fetch('/api/agenda/categories/restore-defaults', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    handleNetworkError(error);
  }
  if (!response.ok) throw await readApiError(response);
  return readSuccessData(response, 'Unable to read restored categories.', readCategories);
}
