import { ApiError } from './error-handler';

/**
 * Parse a positive-integer query parameter. Returns undefined if the param is
 * absent. Throws ApiError(400) if present but not a positive integer.
 */
export function parsePositiveIntParam(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, `invalid ${key} query parameter`, 'invalid_input');
  }
  return n;
}
