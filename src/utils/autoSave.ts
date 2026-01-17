import * as vscode from 'vscode';

/**
 * Best-effort save for a set of URIs.
 * - Opens text documents if needed
 * - Ignores errors (some URIs may not be text, may be readonly, etc.)
 */
export async function saveUris(
    uris: vscode.Uri[]
): Promise<{ savedUris: string[]; failedUris: string[] }> {
    const unique = new Map<string, vscode.Uri>();
    for (const uri of uris) {
        unique.set(uri.toString(), uri);
    }

    const savedUris: string[] = [];
    const failedUris: string[] = [];

    for (const uri of unique.values()) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const saved = await doc.save();
            if (saved) {
                savedUris.push(uri.toString());
            } else {
                failedUris.push(uri.toString());
            }
        } catch {
            failedUris.push(uri.toString());
        }
    }

    return { savedUris, failedUris };
}
