import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const textEditorSchema = z.object({
    action: z
        .enum(['view', 'replace', 'insert', 'create', 'undo'])
        .describe('Action to perform'),
    uri: z.string().optional().describe('File URI (file://...) or absolute file path'),
    content: z.string().optional().describe('File content for create'),
    startLine: z.number().optional().describe('Start line (0-based)'),
    startCharacter: z.number().optional().describe('Start character (0-based)'),
    endLine: z.number().optional().describe('End line (0-based)'),
    endCharacter: z.number().optional().describe('End character (0-based)'),
    text: z.string().optional().describe('Replacement/insert text'),
});

function toUri(uriOrPath: string): vscode.Uri {
    return uriOrPath.startsWith('file://') ? vscode.Uri.parse(uriOrPath) : vscode.Uri.file(uriOrPath);
}

function requireField<T>(value: T | undefined, name: string): T {
    if (value === undefined) {
        throw new Error(`Missing required field: ${name}`);
    }
    return value;
}

export async function textEditor(
    params: z.infer<typeof textEditorSchema>
): Promise<{ success: boolean; message?: string; uri?: string; content?: string }> {
    try {
        if (params.action === 'undo') {
            await vscode.commands.executeCommand('undo');
            return { success: true, message: 'Undo executed' };
        }

        const uriParam = requireField(params.uri, 'uri');
        const uri = toUri(uriParam);

        if (params.action === 'create') {
            const content = requireField(params.content, 'content');
            const bytes = new TextEncoder().encode(content);
            await vscode.workspace.fs.writeFile(uri, bytes);
            return { success: true, message: 'File created', uri: uri.toString() };
        }

        const document = await ensureDocumentOpen(uri);

        if (params.action === 'view') {
            return { success: true, uri: uri.toString(), content: document.getText() };
        }

        const startLine = requireField(params.startLine, 'startLine');
        const startCharacter = requireField(params.startCharacter, 'startCharacter');

        const endLine = params.endLine ?? startLine;
        const endCharacter = params.endCharacter ?? startCharacter;
        const text = requireField(params.text, 'text');

        const range = new vscode.Range(
            new vscode.Position(startLine, startCharacter),
            new vscode.Position(endLine, endCharacter)
        );

        const edit = vscode.TextEdit.replace(range, text);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(uri, [edit]);

        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (!applied) {
            return { success: false, message: 'Failed to apply edit' };
        }

        // Persist changes to disk. applyEdit does not save automatically.
        const saved = await document.save();

        const verb = params.action === 'insert' ? 'Text inserted' : 'Text replaced';
        return {
            success: true,
            message: saved ? `${verb} (saved)` : `${verb} (NOT saved)`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}
