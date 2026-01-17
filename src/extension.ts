import * as vscode from 'vscode';
import { MCPServer } from './server';
import { getConfiguration, onConfigurationChanged, MCPServerConfig } from './config/settings';
import { MCPUriHandler } from './handlers/uriHandler';
import { getAllTools } from './tools';
import { getNgrokPublicUrl } from './utils/ngrok';

let mcpServer: MCPServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('MCP Server');
    log('MCP Server extension activating...');

    const config = getConfiguration();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'codingwithcalvin.mcp.toggle';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codingwithcalvin.mcp.start', startServer),
        vscode.commands.registerCommand('codingwithcalvin.mcp.stop', stopServer),
        vscode.commands.registerCommand('codingwithcalvin.mcp.restart', restartServer),
        vscode.commands.registerCommand('codingwithcalvin.mcp.toggle', toggleServer),
        vscode.commands.registerCommand('codingwithcalvin.mcp.connectionInfo', showConnectionInfo),
        vscode.commands.registerCommand('codingwithcalvin.mcp.showTools', showAvailableTools)
    );

    // Register URI handler
    const uriHandler = new MCPUriHandler({
        onStart: async (port?: number) => {
            if (port !== undefined) {
                // Update config with requested port
                await vscode.workspace
                    .getConfiguration('codingwithcalvin.mcp')
                    .update('port', port, vscode.ConfigurationTarget.Workspace);
            }
            await startServer();
        },
        onStop: stopServer,
        onOpenFolder: async (folderPath: string) => {
            const uri = vscode.Uri.file(folderPath);
            await vscode.commands.executeCommand('vscode.openFolder', uri);
            // Start server after opening folder
            await startServer();
        },
    });
    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

    // Listen for configuration changes
    context.subscriptions.push(
        onConfigurationChanged(async (newConfig: MCPServerConfig) => {
            if (mcpServer?.getIsRunning()) {
                log('Configuration changed, restarting server...');
                await restartServer();
            }
        })
    );

    // Clean up on deactivate
    context.subscriptions.push({
        dispose: async () => {
            await stopServer();
        },
    });

    // Auto-start if configured
    if (config.autoStart) {
        await startServer();
    } else {
        updateStatusBar(false);
    }

    log('MCP Server extension activated');
}

export async function deactivate(): Promise<void> {
    await stopServer();
}

async function startServer(): Promise<void> {
    if (mcpServer?.getIsRunning()) {
        vscode.window.showInformationMessage('MCP server is already running');
        return;
    }

    try {
        const config = getConfiguration();
        mcpServer = new MCPServer(config);
        const port = await mcpServer.start();

        log(`MCP server started on port ${port}`);
        vscode.window.showInformationMessage(`MCP server started on port ${port}`);
        updateStatusBar(true, port);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Failed to start MCP server: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to start MCP server: ${errorMessage}`);
        updateStatusBar(false);
    }
}

async function stopServer(): Promise<void> {
    if (!mcpServer?.getIsRunning()) {
        return;
    }

    try {
        await mcpServer.stop();
        mcpServer = undefined;

        log('MCP server stopped');
        vscode.window.showInformationMessage('MCP server stopped');
        updateStatusBar(false);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Failed to stop MCP server: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to stop MCP server: ${errorMessage}`);
    }
}

async function restartServer(): Promise<void> {
    await stopServer();
    await startServer();
}

async function toggleServer(): Promise<void> {
    if (mcpServer?.getIsRunning()) {
        await stopServer();
    } else {
        await startServer();
    }
}

async function showAvailableTools(): Promise<void> {
    const tools = getAllTools();
    const config = getConfiguration();
    const port = mcpServer?.getPort() || config.port;
    const isRunning = mcpServer?.getIsRunning() || false;

    const items: vscode.QuickPickItem[] = tools.map((tool) => ({
        label: tool.name,
        description: tool.description,
    }));

    const header: vscode.QuickPickItem = {
        label: `MCP Server: ${isRunning ? `Running on port ${port}` : 'Stopped'}`,
        kind: vscode.QuickPickItemKind.Separator,
    };

    const endpoint: vscode.QuickPickItem = {
        label: `$(globe) http://127.0.0.1:${port}/mcp`,
        description: isRunning ? 'Copy to clipboard' : 'Server not running',
    };

    const selected = await vscode.window.showQuickPick([header, endpoint, ...items], {
        title: 'MCP Server Tools',
        placeHolder: 'Select endpoint to copy URL',
    });

    if (selected?.label.includes('/mcp')) {
        const url = `http://127.0.0.1:${port}/mcp`;
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage(`Copied: ${url}`);
    }
}

async function showConnectionInfo(): Promise<void> {
    const config = getConfiguration();
    const port = mcpServer?.getPort() || config.port;
    const isRunning = mcpServer?.getIsRunning() || false;
    const localUrl = `http://127.0.0.1:${port}/mcp`;

    let ngrokPublicUrl: string | undefined;
    try {
        ngrokPublicUrl = await getNgrokPublicUrl();
    } catch {
        ngrokPublicUrl = undefined;
    }

    const items: vscode.QuickPickItem[] = [
        {
            label: 'Local (direct)',
            kind: vscode.QuickPickItemKind.Separator,
        },
        {
            label: `$(globe) ${localUrl}`,
            description: isRunning ? 'Copy to clipboard' : 'Server not running',
        },
        {
            label: 'ngrok (optional)',
            kind: vscode.QuickPickItemKind.Separator,
        },
        ngrokPublicUrl
            ? {
                  label: `$(link-external) ${ngrokPublicUrl}/mcp`,
                  description: 'Copy to clipboard',
              }
            : {
                  label: 'ngrok not detected',
                  description: 'Start ngrok and refresh',
              },
        {
            label: '$(browser) Open ngrok dashboard (localhost:4040)',
            description: 'Shows your public URL',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: 'MCP Server Connection Info',
        placeHolder: 'Select an item to copy/open',
    });

    if (!selected) {
        return;
    }

    if (selected.label.includes('http://127.0.0.1:')) {
        await vscode.env.clipboard.writeText(localUrl);
        vscode.window.showInformationMessage(`Copied: ${localUrl}`);
        return;
    }

    if (ngrokPublicUrl && selected.label.includes(ngrokPublicUrl)) {
        const url = `${ngrokPublicUrl}/mcp`;
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage(`Copied: ${url}`);
        return;
    }

    if (selected.label.includes('ngrok dashboard')) {
        await vscode.env.openExternal(vscode.Uri.parse('http://127.0.0.1:4040'));
    }
}

function updateStatusBar(running: boolean, port?: number): void {
    if (!statusBarItem) {
        return;
    }

    if (running) {
        statusBarItem.text = `$(plug) MCP: ${port}`;
        statusBarItem.tooltip = `MCP Server running on port ${port}\nClick to stop`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(debug-disconnect) MCP: Off';
        statusBarItem.tooltip = 'MCP Server stopped\nClick to start';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    statusBarItem.show();
}

function log(message: string): void {
    const timestamp = new Date().toISOString();
    outputChannel?.appendLine(`[${timestamp}] ${message}`);
}
