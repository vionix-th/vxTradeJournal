export class CliError extends Error {
  constructor(code, message, exitCode = 2, details = {}) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}
export function publicError(error) {
  if (error instanceof CliError) return error;
  if (error.name === "DatabaseError") return new CliError(error.code, error.message, 6, error.details);
  if (error.name === "ConflictError") return new CliError("CONFLICT", error.message, 5, { recovery: "Read current records and reconcile before submitting a new operation." });
  const code = String(error.code || "");
  if (code.includes("permission-denied")) return new CliError("PERMISSION_DENIED", "Firebase denied this user operation.", 6);
  if (["unavailable", "deadline-exceeded", "resource-exhausted", "aborted"].some((part) => code.includes(part)) || error.name === "TimeoutError" || error.name === "AbortError") return new CliError("SERVICE_UNAVAILABLE", "Service unavailable or operation timed out. A write may have committed; check its record or receipt before retrying.", 7);
  if (code.includes("unauthenticated")) return new CliError("AUTH_REQUIRED", "Session is invalid. Sign in again.", 3);
  if (error instanceof SyntaxError) return new CliError("INVALID_INPUT", "Invalid JSON input.");
  if (code === "ENOENT") return new CliError("NOT_FOUND", "Input file was not found.", 4);
  if (code === "EEXIST") return new CliError("OUTPUT_EXISTS", "Output already exists; use --overwrite to replace it.");
  if (error.name === "Error" && !code) return new CliError("VALIDATION", error.message);
  return new CliError("INTERNAL", "Unexpected CLI failure.", 1);
}
