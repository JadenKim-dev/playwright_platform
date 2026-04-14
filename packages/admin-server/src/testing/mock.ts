/** Typed test double: mock method names and signatures are checked against T. */
export function mock<T>(implementation: Partial<T>): T {
  return implementation as T;
}
