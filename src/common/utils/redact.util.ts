/** Webhook tokens act as bearer secrets, so they must never appear in logs. */
export function redactUrl(url: string | undefined): string {
    return (url ?? '').replace(/(\/webhooks\/)[^/?#]+/, '$1[REDACTED]');
}
