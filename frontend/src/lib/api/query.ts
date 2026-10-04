/** Drops keys whose value is undefined so they are not sent as query strings. */
export function stripUndefined<T extends Record<string, unknown>>(
  input: T | undefined,
): Partial<T> | undefined {
  if (!input) return undefined;

  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}
