import * as vscode from 'vscode';

export interface MCPServerConfig {
    autoStart: boolean;
    port: number;
    bindAddress: string;
    allowRemoteConnections: boolean;
    authToken: string;
    enableUnsafeTools: boolean;

    /**
     * Expose this extension's built-in tools.
     */
    enableDefaultTools: boolean;

    /**
     * Expose tools from vscode.lm.tools (which can include tools backed by VS Code MCP servers/extensions).
     */
    enableVSCodeTools: boolean;

    /**
     * Allowlist of exact vscode.lm.tools names (without namespace). This is written by the
     * `MCP Server: Configure VS Code Tools…` command and intentionally not exposed as a Settings UI control.
     */
    vscodeToolsAllowedNames: string[];

    /**
     * Allowlist of built-in tool names (without namespace). This is written by the
     * `MCP Server: Configure Built-in Tools…` command and intentionally not exposed as a Settings UI control.
     */
    defaultToolsAllowedNames: string[];

    /**
     * Whether the user has explicitly configured defaultToolsAllowedNames. When false, all built-in tools are exposed
     * (subject to enableDefaultTools).
     */
    defaultToolsAllowedConfigured: boolean;

    /**
     * Prefer VS Code's built-in workspace text search (findTextInFiles) when available.
     * If disabled (or unavailable), search_workspace_text falls back to a slower implementation.
     */
    useFindTextInFiles: boolean;

    /**
     * If true, tools that apply WorkspaceEdits will also save the affected documents to disk.
     */
    autoSaveAfterToolEdits: boolean;
}

export function getConfiguration(): MCPServerConfig {
    const config = vscode.workspace.getConfiguration('codingwithcalvin.mcp');
    const defaultAllowedInspect =
        typeof (config as unknown as { inspect?: unknown }).inspect === 'function'
            ? config.inspect<string[]>('defaultTools.allowed')
            : undefined;
    const defaultToolsAllowedConfigured =
        defaultAllowedInspect?.workspaceFolderValue !== undefined ||
        defaultAllowedInspect?.workspaceValue !== undefined ||
        defaultAllowedInspect?.globalValue !== undefined;

    return {
        autoStart: config.get<boolean>('autoStart', true),
        port: config.get<number>('port', 4000),
        bindAddress: config.get<string>('bindAddress', '127.0.0.1'),
        allowRemoteConnections: config.get<boolean>('allowRemoteConnections', false),
        authToken: config.get<string>('authToken', ''),
        enableUnsafeTools: config.get<boolean>('enableUnsafeTools', false),
        useFindTextInFiles: config.get<boolean>('useFindTextInFiles', true),
        autoSaveAfterToolEdits: config.get<boolean>('autoSaveAfterToolEdits', true),
        enableDefaultTools: config.get<boolean>('defaultTools.enabled', true),
        enableVSCodeTools: config.get<boolean>('vscodeTools.enabled', false),
        vscodeToolsAllowedNames: config.get<string[]>('vscodeTools.allowed', []),
        defaultToolsAllowedNames: config.get<string[]>('defaultTools.allowed', []),
        defaultToolsAllowedConfigured,
    };
}

export function onConfigurationChanged(
    callback: (config: MCPServerConfig) => void
): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('codingwithcalvin.mcp')) {
            callback(getConfiguration());
        }
    });
}
