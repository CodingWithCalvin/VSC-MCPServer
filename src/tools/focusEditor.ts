import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const focusEditorSchema = z.object({
    uri: z.string().describe('File URI (file://...) or absolute file path'),
    startLine: z.number().describe('Start line (0-based)'),
    startCharacter: z.number().describe('Start character (0-based)'),
    endLine: z.number().optional().describe('End line (0-based)'),
    endCharacter: z.number().optional().describe('End character (0-based)'),
    preserveFocus: z
        .boolean()
        .optional()
        .default(false)
        .describe('Preserve focus in current editor'),
});

export async function focusEditor(
    params: z.infer<typeof focusEditorSchema>
): Promise<{ success: boolean; message?: string }> {
    try {
        const uri = params.uri.startsWith('file://') ? vscode.Uri.parse(params.uri) : vscode.Uri.file(params.uri);
        await ensureDocumentOpen(uri);

        const editor = await vscode.window.showTextDocument(uri, {
            preserveFocus: params.preserveFocus,
            preview: false,
        });

        const endLine = params.endLine ?? params.startLine;
        const endCharacter = params.endCharacter ?? params.startCharacter;

        const range = new vscode.Range(
            new vscode.Position(params.startLine, params.startCharacter),
            new vscode.Position(endLine, endCharacter)
        );

        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}

