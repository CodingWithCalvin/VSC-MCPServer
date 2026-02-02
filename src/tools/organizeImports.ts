import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, ensureDocumentOpen } from '../adapters/vscodeAdapter';
import { getConfiguration } from '../config/settings';
import { saveUris } from '../utils/autoSave';

export const organizeImportsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
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

export async function organizeImports(
    params: z.infer<typeof organizeImportsSchema>
): Promise<{
    success: boolean;
    applied?: boolean;
    saved?: boolean;
    edits?: TextEdit[];
    message?: string;
}> {
    // Handle both file:// URIs and plain paths
    const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

    // Ensure document is open
    await ensureDocumentOpen(uri);

    // Try to get organize imports code action
    const document = await vscode.workspace.openTextDocument(uri);
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
    );

    const codeActions = await vscode.commands.executeCommand<
        (vscode.Command | vscode.CodeAction)[]
    >(
        'vscode.executeCodeActionProvider',
        uri,
        fullRange,
        vscode.CodeActionKind.SourceOrganizeImports.value,
        1
    );

    if (!codeActions || codeActions.length === 0) {
        return {
            success: false,
            message: 'Organize imports not available for this file',
        };
    }

    // Find the organize imports action
    const organizeAction = codeActions.find(
        (action) =>
            'kind' in action &&
            action.kind &&
            action.kind.value === vscode.CodeActionKind.SourceOrganizeImports.value
    ) as vscode.CodeAction | undefined;

    if (!organizeAction || !organizeAction.edit) {
        return {
            success: false,
            message: 'Organize imports action not found or has no edits',
        };
    }

    const workspaceEdit = organizeAction.edit;
    const entries = workspaceEdit.entries();

    if (entries.length === 0) {
        return {
            success: false,
            message: 'No import changes needed',
        };
    }

    // Extract the edits for preview
    const allEdits: TextEdit[] = [];
    for (const [, edits] of entries) {
        for (const edit of edits) {
            if (edit instanceof vscode.TextEdit) {
                allEdits.push({
                    range: rangeToJSON(edit.range),
                    newText: edit.newText,
                });
            }
        }
    }

    // If dry-run, just return the edits without applying
    if (params.dryRun) {
        return {
            success: true,
            applied: false,
            saved: false,
            edits: allEdits,
            message: `Dry-run: ${allEdits.length} import change(s) would be applied`,
        };
    }

    // Apply the edits
    const applied = await vscode.workspace.applyEdit(workspaceEdit);

    if (!applied) {
        return {
            success: false,
            message: 'Failed to apply import changes',
        };
    }

    const config = getConfiguration();
    let saved = false;
    if (config.autoSaveAfterToolEdits) {
        const result = await saveUris(entries.map(([u]) => u));
        saved = result.failedUris.length === 0;
    }

    return {
        success: true,
        applied: true,
        saved,
        edits: allEdits,
        message: `Successfully organized imports with ${allEdits.length} change(s)${
            config.autoSaveAfterToolEdits ? (saved ? ' (saved)' : ' (save failed)') : ''
        }`,
    };
}
