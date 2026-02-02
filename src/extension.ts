import * as vscode from 'vscode';
import { MCPServer } from './server';
import { getConfiguration, onConfigurationChanged, MCPServerConfig } from './config/settings';
import { MCPUriHandler } from './handlers/uriHandler';
import { getAllTools, getBuiltInToolsCatalog } from './tools';
import { getNgrokPublicUrl } from './utils/ngrok';
import { initDebugSessionRegistry } from './utils/debugSessionRegistry';
import { getLanguageModelToolsSnapshot, groupToolNamesByPrefix } from './utils/lmTools';

let mcpServer: MCPServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('MCP Server');
    log('MCP Server extension activating...');

    const config = getConfiguration();

    initDebugSessionRegistry(context);

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
        vscode.commands.registerCommand('codingwithcalvin.mcp.showTools', showAvailableTools),
        vscode.commands.registerCommand('codingwithcalvin.mcp.inspectLmTools', inspectLanguageModelTools),
        vscode.commands.registerCommand('codingwithcalvin.mcp.configureVscodeTools', configureVSCodeTools),
        vscode.commands.registerCommand('codingwithcalvin.mcp.configureDefaultTools', configureBuiltInTools)
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
    const config = getConfiguration();
    const tools = getAllTools(config);
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
        ngrokPublicUrl = await getNgrokPublicUrl('http://127.0.0.1:4040', 750, port);
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
                  description: `Start ngrok for port ${port} and refresh`,
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

async function inspectLanguageModelTools(): Promise<void> {
    const snapshot = getLanguageModelToolsSnapshot();

    if (!vscode.lm) {
        vscode.window.showWarningMessage('vscode.lm is not available in this VS Code build.');
        return;
    }

    if (snapshot.length === 0) {
        vscode.window.showInformationMessage('No tools found in vscode.lm.tools.');
        return;
    }

    const groups = groupToolNamesByPrefix(snapshot.map((t) => t.name));

    const items: vscode.QuickPickItem[] = [
        {
            label: 'Copy all tools as JSON',
            description: `${snapshot.length} tools`,
        },
        {
            label: 'Copy grouped tool names (by prefix)',
            description: `${groups.size} groups`,
        },
        { label: 'Tools', kind: vscode.QuickPickItemKind.Separator },
        ...snapshot.map((tool) => ({
            label: tool.name,
            description: tool.tags.length > 0 ? tool.tags.join(', ') : undefined,
            detail: tool.description || (tool.hasInputSchema ? `inputSchema: ${tool.inputSchemaType ?? 'present'}` : 'no inputSchema'),
        })),
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: 'vscode.lm.tools',
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select a tool to copy its name, or pick an export option',
    });

    if (!selected) {
        return;
    }

    if (selected.label === 'Copy all tools as JSON') {
        await vscode.env.clipboard.writeText(JSON.stringify(snapshot, null, 2));
        vscode.window.showInformationMessage(`Copied ${snapshot.length} tools as JSON`);
        log(`Copied ${snapshot.length} vscode.lm.tools as JSON`);
        return;
    }

    if (selected.label === 'Copy grouped tool names (by prefix)') {
        const grouped = Object.fromEntries([...groups.entries()]);
        await vscode.env.clipboard.writeText(JSON.stringify(grouped, null, 2));
        vscode.window.showInformationMessage(`Copied ${groups.size} groups as JSON`);
        log(`Copied vscode.lm.tools grouped by prefix (${groups.size} groups)`);
        return;
    }

    await vscode.env.clipboard.writeText(selected.label);
    vscode.window.showInformationMessage(`Copied: ${selected.label}`);
}

async function configureVSCodeTools(): Promise<void> {
    const config = getConfiguration();

    if (!vscode.lm?.tools) {
        vscode.window.showWarningMessage('vscode.lm.tools is not available in this VS Code build.');
        return;
    }

    if (!config.enableVSCodeTools) {
        const enable = await vscode.window.showInformationMessage(
            'VS Code tools are currently disabled. Enable them first (codingwithcalvin.mcp.vscodeTools.enabled).',
            'Open Settings'
        );
        if (enable === 'Open Settings') {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'codingwithcalvin.mcp.vscodeTools');
        }
        return;
    }

    const tools = Array.from(vscode.lm.tools).sort((a, b) => a.name.localeCompare(b.name));
    const current = new Set(config.vscodeToolsAllowedNames);

    const items: (vscode.QuickPickItem & { toolName: string })[] = tools.map((tool) => ({
        label: tool.name,
        description: tool.tags?.length ? tool.tags.join(', ') : undefined,
        detail: tool.description || undefined,
        picked: current.has(tool.name),
        toolName: tool.name,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Expose VS Code Tools',
        placeHolder: 'Select which vscode.lm.tools to expose via MCP',
        canPickMany: true,
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!selected) {
        return;
    }

    const allowed = selected.map((s) => s.toolName);
    await vscode.workspace
        .getConfiguration('codingwithcalvin.mcp')
        .update('vscodeTools.allowed', allowed, vscode.ConfigurationTarget.Workspace);

    vscode.window.showInformationMessage(`Exposing ${allowed.length} VS Code tool(s) via MCP`);
    log(`Updated vscodeTools.allowed (${allowed.length} tools)`);
}

async function configureBuiltInTools(): Promise<void> {
    const config = getConfiguration();

    if (config.enableDefaultTools === false) {
        const enable = await vscode.window.showInformationMessage(
            'Built-in tools are currently disabled (codingwithcalvin.mcp.defaultTools.enabled).',
            'Open Settings'
        );
        if (enable === 'Open Settings') {
            await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'codingwithcalvin.mcp.defaultTools'
            );
        }
        return;
    }

    const catalog = getBuiltInToolsCatalog();
    const current = config.defaultToolsAllowedConfigured
        ? new Set(config.defaultToolsAllowedNames)
        : new Set(catalog.map((t) => t.name));

    const items: (vscode.QuickPickItem & { toolName: string })[] = catalog.map((tool) => ({
        label: tool.name,
        detail: tool.description,
        picked: current.has(tool.name),
        toolName: tool.name,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Expose Built-in Tools',
        placeHolder: 'Select which built-in tools to expose via MCP (empty = expose none)',
        canPickMany: true,
        matchOnDetail: true,
    });

    if (!selected) {
        return;
    }

    const allowed = selected.map((s) => s.toolName);
    await vscode.workspace
        .getConfiguration('codingwithcalvin.mcp')
        .update('defaultTools.allowed', allowed, vscode.ConfigurationTarget.Workspace);

    vscode.window.showInformationMessage(`Exposing ${allowed.length} built-in tool(s) via MCP`);
    log(`Updated defaultTools.allowed (${allowed.length} tools)`);
}
