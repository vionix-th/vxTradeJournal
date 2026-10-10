/** Application status comes from commit evidence, never calculation completeness. */
export function writeOutcome(error, { started = false, confirmed = false } = {}) {
  if (error.writeOutcome) return error.writeOutcome;
  const rejected = ['ValidationError', 'ConflictError'].includes(error.name) ||
    ['permission-denied', 'invalid-argument', 'unauthenticated', 'not-found', 'already-exists', 'failed-precondition'].some((code) => String(error.code).endsWith(code));
  return { state: confirmed ? 'applied' : !started || rejected ? 'not_applied' : 'unknown' };
}
