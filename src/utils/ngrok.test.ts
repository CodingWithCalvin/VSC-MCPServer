import { describe, it, expect } from 'vitest';
import * as http from 'http';
import { getNgrokPublicUrl } from './ngrok';

function startServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
    return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                throw new Error('Failed to bind test server');
            }
            resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
        });
    });
}

describe('getNgrokPublicUrl', () => {
    it('prefers https tunnel when present', async () => {
        const { server, baseUrl } = await startServer((req, res) => {
            if (req.url !== '/api/tunnels') {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(
                JSON.stringify({
                    tunnels: [
                        { proto: 'http', public_url: 'http://example.ngrok.io' },
                        { proto: 'https', public_url: 'https://secure.ngrok.io' },
                    ],
                })
            );
        });

        try {
            await expect(getNgrokPublicUrl(baseUrl, 1000)).resolves.toBe('https://secure.ngrok.io');
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('returns undefined when no tunnels exist', async () => {
        const { server, baseUrl } = await startServer((req, res) => {
            if (req.url !== '/api/tunnels') {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ tunnels: [] }));
        });

        try {
            await expect(getNgrokPublicUrl(baseUrl, 1000)).resolves.toBeUndefined();
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('can select tunnel by local port when multiple tunnels exist', async () => {
        const { server, baseUrl } = await startServer((req, res) => {
            if (req.url !== '/api/tunnels') {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(
                JSON.stringify({
                    tunnels: [
                        {
                            proto: 'https',
                            public_url: 'https://wrong-port.ngrok.io',
                            config: { addr: 'http://127.0.0.1:3000' },
                        },
                        {
                            proto: 'https',
                            public_url: 'https://right-port.ngrok.io',
                            config: { addr: '127.0.0.1:4000' },
                        },
                    ],
                })
            );
        });

        try {
            await expect(getNgrokPublicUrl(baseUrl, 1000, 4000)).resolves.toBe('https://right-port.ngrok.io');
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
