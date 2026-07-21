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
  scope: string,
  error: unknown,
  context: LogContext = {},
) {
  // Expo CLI forwards console logs to the Metro terminal. Using console.log
  // here prevents caught diagnostic errors from opening React Native LogBox.
  console.log(`[PresenSure:error] ${scope}`, {
    timestamp: new Date().toISOString(),
    ...describeError(error),
    context,
  });
}
