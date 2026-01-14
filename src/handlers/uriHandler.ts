import * as vscode from 'vscode';

export interface UriHandlerCallbacks {
    onStart: (port?: number) => Promise<void>;
    onStop: () => Promise<void>;
    onOpenFolder: (folderPath: string) => Promise<void>;
}

export class MCPUriHandler implements vscode.UriHandler {
    constructor(private callbacks: UriHandlerCallbacks) {}

    async handleUri(uri: vscode.Uri): Promise<void> {
        const path = uri.path;
        const query = new URLSearchParams(uri.query);

        console.log(`Handling URI: ${uri.toString()}`);

        switch (path) {
            case '/start':
                const portStr = query.get('port');
                const port = portStr ? parseInt(portStr, 10) : undefined;
                await this.callbacks.onStart(port);
                break;

            case '/stop':
                await this.callbacks.onStop();
                break;

            case '/open':
                const folder = query.get('folder');
                if (folder) {
                    await this.callbacks.onOpenFolder(folder);
                } else {
                    vscode.window.showErrorMessage('Missing folder parameter in URI');
                }
                break;

            default:
                vscode.window.showWarningMessage(`Unknown MCP Server URI path: ${path}`);
        }
    }
}
