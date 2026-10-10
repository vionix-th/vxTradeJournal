/** Stable machine context, separate from human messages and application outcomes. */
export class ValidationError extends Error {
  constructor(message, { rule = 'DOMAIN_INVARIANT', path = null, recordId = null, rejectedValue, relatedPaths } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = { rule, path, recordId };
    if (rejectedValue === null || ['number', 'boolean'].includes(typeof rejectedValue) || typeof rejectedValue === 'string' && rejectedValue.length <= 120) this.details.rejectedValue = rejectedValue;
    if (relatedPaths) this.details.relatedPaths = relatedPaths;
  }
}
export function validationContext(operation, path, recordId = null) {
  try { return operation(); }
  catch (error) {
    if (error instanceof ValidationError) {
      error.details.path = `${path}${error.details.path || ''}` || null;
      error.details.recordId ||= recordId;
    }
    throw error;
  }
}
