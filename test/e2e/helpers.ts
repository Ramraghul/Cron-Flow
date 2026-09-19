import { createServer, IncomingHttpHeaders } from 'node:http';
import { AddressInfo } from 'node:net';

export interface RecordedRequest {
    method: string;
    path: string;
    headers: IncomingHttpHeaders;
    body: string;
}

export interface HttpTarget {
    url(path: string): string;
    requests: RecordedRequest[];
    close(): Promise<void>;
}

/**
 * A local HTTP server for workflow steps to call. It records every request and responds by path:
 *   /fail…  → always 500
 *   /flaky… → 503 on the first call, then 200
 *   other   → 200
 */
export async function startHttpTarget(): Promise<HttpTarget> {
    const requests: RecordedRequest[] = [];
    const hitsByPath = new Map<string, number>();

    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
            const path = req.url ?? '/';
            const hits = (hitsByPath.get(path) ?? 0) + 1;
            hitsByPath.set(path, hits);
            requests.push({ method: req.method ?? 'GET', path, headers: req.headers, body });

            if (path.startsWith('/fail')) {
                res.writeHead(500).end('upstream exploded');
            } else if (path.startsWith('/flaky') && hits === 1) {
                res.writeHead(503).end('warming up');
            } else {
                res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
            }
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: (path) => `http://127.0.0.1:${port}${path}`,
        requests,
        close: () =>
            new Promise((resolve, reject) => {
                server.closeAllConnections();
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}

/** Polls `probe` until `isDone` accepts its value, failing with the last value after `timeoutMs`. */
export async function waitFor<T>(
    probe: () => Promise<T>,
    isDone: (value: T) => boolean,
    { timeoutMs = 20_000, intervalMs = 100 } = {},
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await probe();
        if (isDone(value)) {
            return value;
        }
        if (Date.now() > deadline) {
            throw new Error(`Condition not met within ${timeoutMs}ms. Last value: ${JSON.stringify(value)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}
