/** Extracts a readable message from any thrown value, appending a nested `cause` when it adds information. */
export function errorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }

    const cause = error.cause instanceof Error ? error.cause.message : undefined;
    return cause && !error.message.includes(cause) ? `${error.message} (${cause})` : error.message;
}
