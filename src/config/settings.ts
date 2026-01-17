import * as vscode from 'vscode';

export interface MCPServerConfig {
    autoStart: boolean;
    port: number;
    bindAddress: string;
    allowRemoteConnections: boolean;
    authToken: string;
    enableUnsafeTools: boolean;

    /**
     * Prefer VS Code's built-in workspace text search (findTextInFiles) when available.
     * If disabled (or unavailable), search_workspace_text falls back to a slower implementation.
     */
    useFindTextInFiles: boolean;
}

export function getConfiguration(): MCPServerConfig {
    const config = vscode.workspace.getConfiguration('codingwithcalvin.mcp');

    return {
        autoStart: config.get<boolean>('autoStart', true),
        port: config.get<number>('port', 4000),
        bindAddress: config.get<string>('bindAddress', '127.0.0.1'),
        allowRemoteConnections: config.get<boolean>('allowRemoteConnections', false),
        authToken: config.get<string>('authToken', ''),
        enableUnsafeTools: config.get<boolean>('enableUnsafeTools', false),
        useFindTextInFiles: config.get<boolean>('useFindTextInFiles', true),
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
