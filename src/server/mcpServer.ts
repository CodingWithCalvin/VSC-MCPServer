import * as http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServerConfig } from '../config/settings';
import { getAllTools, callTool } from '../tools';

export class MCPServer {
    private server: Server;
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

    private setupMiddleware(): void {
        // Parse JSON bodies
        this.app.use(express.json());

        // DNS rebinding protection - only allow localhost
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const host = req.headers.host || '';
            if (
                !host.startsWith('localhost:') &&
                !host.startsWith('127.0.0.1:') &&
                host !== 'localhost' &&
                host !== '127.0.0.1'
            ) {
                res.status(403).json({ error: 'Forbidden: Invalid host header' });
                return;
            }
            next();
        });

        // CORS for localhost only
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const origin = req.headers.origin || '';
            if (
                !origin ||
                origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)
            ) {
                res.header('Access-Control-Allow-Origin', origin || '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
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

        // MCP endpoint - simplified JSON-RPC over HTTP
        this.app.post('/mcp', async (req: Request, res: Response) => {
            try {
                const { method, params, id } = req.body;

                if (method === 'initialize') {
                    res.json({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: {
                                tools: {},
                            },
                            serverInfo: {
                                name: 'vscode-mcp',
                                version: '0.1.0',
                            },
                        },
                    });
                    return;
                }

                if (method === 'tools/list') {
                    const tools = getAllTools();
                    res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { tools },
                    });
                    return;
                }

                if (method === 'tools/call') {
                    const { name, arguments: args } = params;
                    const result = await callTool(name, args || {});
                    res.json({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        },
                    });
                    return;
                }

                res.json({
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                res.json({
                    jsonrpc: '2.0',
                    id: req.body?.id,
                    error: {
                        code: -32603,
                        message: errorMessage,
                    },
                });
            }
        });
    }

    async start(): Promise<number> {
        if (this.isRunning) {
            return this.actualPort;
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

        return new Promise((resolve) => {
            this.httpServer?.close(() => {
                this.isRunning = false;
                this.actualPort = 0;
                console.log('MCP Server stopped');
                resolve();
            });
        });
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
