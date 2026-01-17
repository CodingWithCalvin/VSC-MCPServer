import * as vscode from 'vscode';

/**
 * Best-effort save for a set of URIs.
 * - Opens text documents if needed
 * - Ignores errors (some URIs may not be text, may be readonly, etc.)
 */
export async function saveUris(uris: vscode.Uri[]): Promise<void> {
    const unique = new Map<string, vscode.Uri>();
    for (const uri of uris) {
        unique.set(uri.toString(), uri);
    }

    for (const uri of unique.values()) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await doc.save();
        } catch {
            // ignore
        }
    }
}
