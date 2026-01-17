import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, ensureDocumentOpen } from '../adapters/vscodeAdapter';
import { getConfiguration } from '../config/settings';

export const formatRangeSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    startLine: z.number().describe('0-indexed start line number'),
    startCharacter: z.number().describe('0-indexed start character position'),
    endLine: z.number().describe('0-indexed end line number'),
    endCharacter: z.number().describe('0-indexed end character position'),
    dryRun: z
        .boolean()
        .optional()
        .describe('Preview changes without applying them (default: false)'),
});

export interface TextEdit {
    range: {
        startLine: number;
        startCharacter: number;
        endLine: number;
        endCharacter: number;
    };
    newText: string;
}

export async function formatRange(
    params: z.infer<typeof formatRangeSchema>
): Promise<{ success: boolean; edits?: TextEdit[]; message?: string }> {
    // Handle both file:// URIs and plain paths
    const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

    // Ensure document is open
    const document = await ensureDocumentOpen(uri);

    const range = new vscode.Range(
        new vscode.Position(params.startLine, params.startCharacter),
        new vscode.Position(params.endLine, params.endCharacter)
    );

    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatRangeProvider',
        uri,
        range,
        {
            tabSize: 4,
            insertSpaces: true,
        }
    );

    if (!edits || edits.length === 0) {
        return {
            success: false,
            message: 'No formatting changes needed or formatter not available',
        };
    }

    const textEdits: TextEdit[] = edits.map((edit) => ({
        range: rangeToJSON(edit.range),
        newText: edit.newText,
    }));

    // If dry-run, just return the edits without applying
    if (params.dryRun) {
        return {
            success: true,
            edits: textEdits,
            message: `Dry-run: ${edits.length} formatting change(s) would be applied`,
        };
    }

    // Apply the edits
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(uri, edits);

    const applied = await vscode.workspace.applyEdit(workspaceEdit);

    if (!applied) {
        return {
            success: false,
            message: 'Failed to apply formatting changes',
        };
    }

    const config = getConfiguration();
    if (config.autoSaveAfterToolEdits) {
        await document.save();
    }

    return {
        success: true,
        edits: textEdits,
        message: `Successfully formatted range with ${edits.length} change(s)${config.autoSaveAfterToolEdits ? ' (saved)' : ''}`,
    };
}
