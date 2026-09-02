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
