/** A value the code under test must have produced; fails the test when it is missing. */
export function must<T>(v: T | null | undefined, what: string): T {
  if (v == null) throw new Error(`${what} missing`);
  return v;
}
