export type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return { name: "UnknownError", message: "An unknown error occurred." };
}

/**
 * Logs diagnostic metadata only. Callers must never pass credentials, BLE
 * tokens, signatures, device secrets, face data, or authorization headers.
 */
export function logError(
  _scope: string,
  _error: unknown,
  _context: LogContext = {},
) {
  // Logs removed
}
