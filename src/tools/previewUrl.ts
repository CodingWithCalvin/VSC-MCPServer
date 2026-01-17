import * as vscode from 'vscode';
import { z } from 'zod';

export const previewUrlSchema = z.object({
    url: z.string().describe('URL to open'),
});

export async function previewUrl(
    params: z.infer<typeof previewUrlSchema>
): Promise<{ success: boolean; message?: string }> {
    try {
        // Prefer VS Code's simple browser, then fall back to external browser.
        try {
            await vscode.commands.executeCommand('simpleBrowser.show', params.url);
            return { success: true, message: 'Opened URL in VS Code Simple Browser' };
        } catch {
            await vscode.env.openExternal(vscode.Uri.parse(params.url));
            return { success: true, message: 'Opened URL externally' };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}

