import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as http from 'http';

// Mock vscode module - must be before imports that use vscode indirectly via tools
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { resetMocks } from '../test/helpers/mockVscode';

let MCPServer: typeof import('./mcpServer').MCPServer;

type HttpResponse = {
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
};

function httpRequest(options: {
    port: number;
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
}): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: '127.0.0.1',
                port: options.port,
                method: options.method,
                path: options.path,
                headers: options.headers,
            },
            (response) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => {
                    resolve({
                        status: response.statusCode || 0,
                        headers: response.headers,
                        body: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            }
        );

        request.on('error', reject);

        if (options.body !== undefined) {
            const payload = JSON.stringify(options.body);
            request.setHeader('Content-Type', 'application/json');
            request.setHeader('Content-Length', Buffer.byteLength(payload));
            request.write(payload);
        }

        request.end();
    });
}

describe('MCPServer HTTP middleware', () => {
    beforeAll(async () => {
        ({ MCPServer } = await import('./mcpServer'));
    });

    beforeEach(() => {
        resetMocks();
    });

    it('allows localhost Host header by default', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: false,
            authToken: '',
        });

        const port = await server.start();
        try {
            const res = await httpRequest({ port, method: 'GET', path: '/health' });
            expect(res.status).toBe(200);
        } finally {
            await server.stop();
        }
    });

    it('rejects non-local Host header by default (403)', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: false,
            authToken: '',
        });

        const port = await server.start();
        try {
            const res = await httpRequest({
                port,
                method: 'GET',
                path: '/health',
                headers: { Host: 'example.ngrok-free.app' },
            });
            expect(res.status).toBe(403);
        } finally {
            await server.stop();
        }
    });

    it('fails to start when remote connections enabled without authToken', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: true,
            authToken: '',
        });

        await expect(server.start()).rejects.toThrow(/auth token/i);
    });

    it('requires bearer token when authToken is set (401)', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: true,
            authToken: 'secret-token',
        });

        const port = await server.start();
        try {
            const res = await httpRequest({
                port,
                method: 'GET',
                path: '/health',
                headers: { Host: 'example.ngrok-free.app' },
            });
            expect(res.status).toBe(401);
        } finally {
            await server.stop();
        }
    });

    it('accepts remote Host header when allowRemoteConnections enabled and token matches (200)', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: true,
            authToken: 'secret-token',
        });

        const port = await server.start();
        try {
            const res = await httpRequest({
                port,
                method: 'GET',
                path: '/health',
                headers: {
                    Host: 'example.ngrok-free.app',
                    Authorization: 'Bearer secret-token',
                },
            });
            expect(res.status).toBe(200);
        } finally {
            await server.stop();
        }
    });

    it('allows CORS preflight (OPTIONS) without auth and advertises Authorization header', async () => {
        const server = new MCPServer({
            autoStart: false,
            port: 0,
            bindAddress: '127.0.0.1',
            allowRemoteConnections: true,
            authToken: 'secret-token',
        });

        const port = await server.start();
        try {
            const res = await httpRequest({
                port,
                method: 'OPTIONS',
                path: '/mcp',
                headers: {
                    Host: 'example.ngrok-free.app',
                    Origin: 'https://example.ngrok-free.app',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type,authorization',
                },
            });
            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
            expect(res.headers['access-control-allow-origin']).toBe('https://example.ngrok-free.app');
        } finally {
            await server.stop();
        }
    });
});
