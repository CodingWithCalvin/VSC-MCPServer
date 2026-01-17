import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, ensureDocumentOpen } from '../adapters/vscodeAdapter';
import { getConfiguration } from '../config/settings';
import { saveUris } from '../utils/autoSave';

export const renameSymbolSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
    newName: z.string().describe('New name for the symbol'),
    dryRun: z
        .boolean()
        .optional()
        .describe('Preview changes without applying them (default: false)'),
});

export interface FileEdit {
    uri: string;
    edits: {
        range: {
            startLine: number;
            startCharacter: number;
            endLine: number;
            endCharacter: number;
        };
        newText: string;
    }[];
}

export async function renameSymbol(
    params: z.infer<typeof renameSymbolSchema>
): Promise<{ success: boolean; changes?: FileEdit[]; message?: string }> {
    // Handle both file:// URIs and plain paths
    const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const position = new vscode.Position(params.line, params.character);

    const workspaceEdit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        uri,
        position,
        params.newName
    );

    if (!workspaceEdit) {
        return {
            success: false,
            message: 'Rename not available for this symbol',
        };
    }

    const entries = workspaceEdit.entries();

    if (entries.length === 0) {
        return {
            success: false,
            message: 'No rename changes generated',
        };
    }

    // Extract all changes for preview
    const fileEdits: FileEdit[] = [];
    for (const [fileUri, edits] of entries) {
        const textEdits = edits
            .filter((edit) => edit instanceof vscode.TextEdit)
            .map((edit) => ({
                range: rangeToJSON((edit as vscode.TextEdit).range),
                newText: (edit as vscode.TextEdit).newText,
            }));

        if (textEdits.length > 0) {
            fileEdits.push({
                uri: fileUri.toString(),
                edits: textEdits,
            });
        }
    }

    const totalEdits = fileEdits.reduce((sum, file) => sum + file.edits.length, 0);

    // If dry-run, just return the changes without applying
    if (params.dryRun) {
        return {
            success: true,
            changes: fileEdits,
            message: `Dry-run: Would rename symbol in ${fileEdits.length} file(s) with ${totalEdits} change(s)`,
        };
    }

    // Apply the edits
    const applied = await vscode.workspace.applyEdit(workspaceEdit);

    if (!applied) {
        return {
            success: false,
            message: 'Failed to apply rename changes',
        };
    }

    const config = getConfiguration();
    if (config.autoSaveAfterToolEdits) {
        await saveUris(entries.map(([u]) => u));
    }

    return {
        success: true,
        changes: fileEdits,
        message: `Successfully renamed symbol in ${fileEdits.length} file(s) with ${totalEdits} change(s)${config.autoSaveAfterToolEdits ? ' (saved)' : ''}`,
    };
}
