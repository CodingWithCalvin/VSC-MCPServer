import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the tools module so the server can be exercised without the vscode API.
vi.mock('../tools', () => ({
    getAllTools: vi.fn(() => [
        { name: 'sampleTool', description: 'A sample tool', inputSchema: { type: 'object', properties: {} } },
    ]),
    callTool: vi.fn(async (name: string) => {
        if (name === 'explodingTool') {
            throw new Error('boom');
        }
        return { ok: true, name };
    }),
}));

import { MCPServer } from './mcpServer';
import type { MCPServerConfig } from '../config/settings';

const config: MCPServerConfig = {
    autoStart: false,
    port: 0,
    bindAddress: '127.0.0.1',
};

describe('MCPServer JSON-RPC HTTP compatibility', () => {
    let server: MCPServer;
    let baseUrl: string;

    beforeEach(async () => {
        server = new MCPServer(config);
        const port = await server.start();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        await server.stop();
    });

    const post = (body: unknown) =>
        fetch(`${baseUrl}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

    describe('GET /mcp', () => {
        it('is reachable for probing clients and returns transport metadata', async () => {
            const res = await fetch(`${baseUrl}/mcp`);
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json).toMatchObject({ status: 'ok', transport: 'jsonrpc-http', endpoint: '/mcp' });
        });
    });

    describe('GET /health', () => {
        it('reports server status', async () => {
            const res = await fetch(`${baseUrl}/health`);
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.status).toBe('ok');
        });
    });

    describe('requests with an id', () => {
        it('echoes the id on initialize', async () => {
            const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize' });
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.id).toBe(1);
            expect(json.result.serverInfo.name).toBe('vscode-mcp');
        });

        it('preserves an id of 0', async () => {
            const res = await post({ jsonrpc: '2.0', id: 0, method: 'tools/list' });
            const json = await res.json();
            expect(json.id).toBe(0);
            expect(json.result.tools).toHaveLength(1);
        });

        it('returns tool results for tools/call', async () => {
            const res = await post({
                jsonrpc: '2.0',
                id: 'abc',
                method: 'tools/call',
                params: { name: 'sampleTool', arguments: {} },
            });
            const json = await res.json();
            expect(json.id).toBe('abc');
            const payload = JSON.parse(json.result.content[0].text);
            expect(payload).toEqual({ ok: true, name: 'sampleTool' });
        });

        it('preserves the id on method-not-found errors', async () => {
            const res = await post({ jsonrpc: '2.0', id: 7, method: 'does/notExist' });
            const json = await res.json();
            expect(json.id).toBe(7);
            expect(json.error.code).toBe(-32601);
        });

        it('preserves the id when a tool throws', async () => {
            const res = await post({
                jsonrpc: '2.0',
                id: 42,
                method: 'tools/call',
                params: { name: 'explodingTool', arguments: {} },
            });
            const json = await res.json();
            expect(json.id).toBe(42);
            expect(json.error.code).toBe(-32603);
            expect(json.error.message).toBe('boom');
        });
    });

    describe('notifications (no id)', () => {
        it('returns 202 with an empty body for a known notification method', async () => {
            const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
            expect(res.status).toBe(202);
            expect(await res.text()).toBe('');
        });

        it('returns 202 with an empty body for initialize without an id', async () => {
            const res = await post({ jsonrpc: '2.0', method: 'initialize' });
            expect(res.status).toBe(202);
            expect(await res.text()).toBe('');
        });

        it('returns 202 (no error body) for an unknown notification', async () => {
            const res = await post({ jsonrpc: '2.0', method: 'unknown/method' });
            expect(res.status).toBe(202);
            expect(await res.text()).toBe('');
        });
    });
});
