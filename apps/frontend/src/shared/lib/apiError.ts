/**
 * The sentence to show when a call fails.
 *
 * The API states what went wrong in the response body, and that sentence is
 * always better than anything the caller could guess. A transport failure has
 * no body and falls back to the error's own message, and only when there is
 * neither does the caller's fallback speak.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
    return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (error instanceof Error ? error.message : fallback);
}

/**
 * The same sentence, for the callers that keep their own.
 *
 * A page notice names what the application could not do and puts the server's
 * reason under it, so those two have to stay apart. Absent when the server said
 * nothing worth adding.
 */
export function apiErrorDetail(error: unknown): string | undefined {
    return (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
}
