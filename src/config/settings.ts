import * as vscode from 'vscode';

export interface MCPServerConfig {
    autoStart: boolean;
    port: number;
    bindAddress: string;
}

export function getConfiguration(): MCPServerConfig {
    const config = vscode.workspace.getConfiguration('codingwithcalvin.mcp');

    return {
        autoStart: config.get<boolean>('autoStart', true),
        port: config.get<number>('port', 4000),
        bindAddress: config.get<string>('bindAddress', '127.0.0.1'),
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
