import * as http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServerConfig } from '../config/settings';
import { getAllTools, callTool } from '../tools';

export class MCPServer {
    private server: Server;
    private transport: StreamableHTTPServerTransport | undefined;
    private httpServer: http.Server | undefined;
    private app: express.Application;
    private isRunning: boolean = false;
    private actualPort: number = 0;

    constructor(private config: MCPServerConfig) {
        this.server = new Server(
            {
                name: 'vscode-mcp',
                version: '0.1.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.app = express();
        this.setupMiddleware();
        this.setupMCPHandlers();
    }

    private shouldRequireAuth(): boolean {
        return this.config.allowRemoteConnections || this.config.authToken.trim().length > 0;
    }

    private validateAuthConfiguration(): void {
        if (this.config.allowRemoteConnections && this.config.authToken.trim().length === 0) {
            throw new Error(
                'Remote connections are enabled but no auth token is configured. Set codingwithcalvin.mcp.authToken.'
            );
        }
    }

    private setupMiddleware(): void {
        // Robust request body parsing for /mcp: accept JSON even when clients use non-standard content-types.
        // We intentionally parse as raw bytes and decode ourselves so we can also fall back to header-based payloads.
        this.app.use('/mcp', express.raw({ type: '*/*', limit: '10mb' }));

        // Parse JSON bodies for non-MCP endpoints (e.g. future config routes).
        this.app.use(express.json({ limit: '2mb' }));

        // Optional bearer token auth (recommended for tunnels)
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            if (req.method === 'OPTIONS') {
                next();
                return;
            }

            if (!this.shouldRequireAuth()) {
                next();
                return;
            }

            const expected = this.config.authToken.trim();
            const authorization = req.header('authorization') || '';
            const match = authorization.match(/^Bearer\s+(.+)$/i);
            const provided = match?.[1]?.trim() || '';

            if (!expected || provided !== expected) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            (req as unknown as { __mcpAuthOk?: boolean }).__mcpAuthOk = true;
            next();
        });

        // DNS rebinding protection - only allow localhost unless explicitly enabled
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            if ((req as unknown as { __mcpAuthOk?: boolean }).__mcpAuthOk) {
                next();
                return;
            }

            if (this.config.allowRemoteConnections) {
                next();
                return;
            }

            const host = req.headers.host || '';
            if (
                !host.startsWith('localhost:') &&
                !host.startsWith('127.0.0.1:') &&
                !host.startsWith('[::1]:') &&
                host !== 'localhost' &&
                host !== '127.0.0.1' &&
                host !== '[::1]'
            ) {
                res.status(403).json({ error: 'Forbidden: Invalid host header' });
                return;
            }
            next();
        });

        // CORS for localhost only unless explicitly enabled
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const origin = req.headers.origin || '';
            if (
                !origin ||
                this.config.allowRemoteConnections ||
                origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/)
            ) {
                res.header('Access-Control-Allow-Origin', origin || '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
                res.header(
                    'Access-Control-Allow-Headers',
                    'Content-Type, mcp-session-id, mcp-protocol-version, cf-mcp-message, Authorization'
                );
                res.header('Vary', 'Origin');
            }
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
                return;
            }
            next();
        });
    }

    private setupMCPHandlers(): void {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: getAllTools(),
            };
        });

        // Call a tool
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                const result = await callTool(name, args || {});
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ error: errorMessage }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ status: 'ok', port: this.actualPort });
        });

        // MCP endpoint - MCP Streamable HTTP transport (supports POST JSON-RPC and GET SSE).
        this.app.all('/mcp', async (req: Request, res: Response) => {
            if (!this.transport) {
                res.status(503).json({ error: 'MCP transport not initialized' });
                return;
            }

            if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
                res.status(405).json({ error: `Method not allowed: ${req.method}` });
                return;
            }

            const parsedBody = this.getParsedMcpBody(req, res);
            if (parsedBody === undefined && req.method === 'POST') {
                return;
            }

            if (req.method === 'POST') {
                // The Streamable HTTP transport is strict about Accept/Content-Type headers.
                // For interoperability (older clients, some proxies, cf-mcp-message), fall back to legacy JSON-RPC when
                // headers aren't compliant.
                const accept = String(req.headers['accept'] || '');
                const contentType = String(req.headers['content-type'] || '');
                const isStreamableCompliant =
                    accept.includes('application/json') &&
                    accept.includes('text/event-stream') &&
                    contentType.includes('application/json');

                if (!isStreamableCompliant) {
                    await this.handleLegacyJsonRpcOverHttp(parsedBody, res);
                    return;
                }
            }

            await this.transport.handleRequest(req, res, parsedBody);
        });
    }

    private async handleLegacyJsonRpcOverHttp(payload: unknown, res: Response): Promise<void> {
        const handleOne = async (message: unknown): Promise<unknown | undefined> => {
            const body = message as { method?: unknown; params?: unknown; id?: unknown; jsonrpc?: unknown };
            const id = body?.id as unknown;

            // Notification: do not return a response.
            if (id === undefined || id === null) {
                return undefined;
            }

            const method = typeof body?.method === 'string' ? body.method : '';
            const params = (body?.params ?? {}) as unknown;

            try {
                if (method === 'initialize') {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: { tools: {} },
                            serverInfo: { name: 'vscode-mcp', version: '0.1.0' },
                        },
                    };
                }

                if (method === 'tools/list') {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: { tools: getAllTools() },
                    };
                }

                if (method === 'tools/call') {
                    const callParams = params as { name?: unknown; arguments?: unknown };
                    const name = typeof callParams?.name === 'string' ? callParams.name : '';
                    const args = (callParams?.arguments ?? {}) as Record<string, unknown>;
                    const result = await callTool(name, args);
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        },
                    };
                }

                return {
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32601, message: `Method not found: ${method}` },
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32603, message: errorMessage },
                };
            }
        };

        if (Array.isArray(payload)) {
            const responses = (await Promise.all(payload.map(handleOne))).filter(
                (item): item is unknown => item !== undefined
            );
            if (responses.length === 0) {
                res.sendStatus(204);
                return;
            }
            res.json(responses);
            return;
        }

        const response = await handleOne(payload);
        if (response === undefined) {
            res.sendStatus(204);
            return;
        }
        res.json(response);
    }

    private getParsedMcpBody(req: Request, res: Response): unknown | undefined {
        if (req.method !== 'POST') {
            return undefined;
        }

        const headerPayload = req.header('cf-mcp-message');
        const rawBody = req.body;

        const candidates: Array<string | Buffer> = [];
        if (rawBody && (typeof rawBody === 'string' || Buffer.isBuffer(rawBody))) {
            candidates.push(rawBody);
        }
        if (headerPayload) {
            candidates.push(headerPayload);
            try {
                candidates.push(decodeURIComponent(headerPayload));
            } catch {
                // ignore
            }
            try {
                const decoded = Buffer.from(headerPayload, 'base64').toString('utf8');
                candidates.push(decoded);
            } catch {
                // ignore
            }
        }

        for (const candidate of candidates) {
            const text = Buffer.isBuffer(candidate) ? candidate.toString('utf8') : candidate;
            if (!text || !text.trim()) {
                continue;
            }
            try {
                return JSON.parse(text);
            } catch {
                continue;
            }
        }

        if (candidates.length > 0) {
            res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' },
            });
            return undefined;
        }

        return undefined;
    }

    async start(): Promise<number> {
        if (this.isRunning) {
            return this.actualPort;
        }

        this.validateAuthConfiguration();

        if (!this.transport) {
            this.transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            await this.server.connect(this.transport);
        }

        this.setupRoutes();

        return new Promise((resolve, reject) => {
            this.httpServer = this.app.listen(
                this.config.port,
                this.config.bindAddress,
                () => {
                    const address = this.httpServer?.address();
                    if (address && typeof address === 'object') {
                        this.actualPort = address.port;
                    } else {
                        this.actualPort = this.config.port;
                    }
                    this.isRunning = true;
                    console.log(
                        `MCP Server listening on http://${this.config.bindAddress}:${this.actualPort}/mcp`
                    );
                    resolve(this.actualPort);
                }
            );

            this.httpServer.on('error', (error) => {
                this.isRunning = false;
                reject(error);
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.httpServer) {
            return;
        }

        await new Promise<void>((resolve) => {
            this.httpServer?.close(() => {
                this.isRunning = false;
                this.actualPort = 0;
                console.log('MCP Server stopped');
                resolve();
            });
        });

        await this.transport?.close();
        this.transport = undefined;
    }

    async restart(): Promise<number> {
        await this.stop();
        return this.start();
    }

    getPort(): number {
        return this.actualPort;
    }

    getIsRunning(): boolean {
        return this.isRunning;
    }
}
