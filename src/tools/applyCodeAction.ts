import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const applyCodeActionSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    startLine: z.number().describe('0-indexed start line number'),
    startCharacter: z.number().describe('0-indexed start character position'),
    endLine: z.number().describe('0-indexed end line number'),
    endCharacter: z.number().describe('0-indexed end character position'),
    actionTitle: z
        .string()
        .describe('Title of the code action to apply (must match exactly)'),
    kind: z
        .string()
        .optional()
        .describe('Filter by action kind (e.g., "quickfix", "refactor")'),
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

export async function applyCodeAction(
    params: z.infer<typeof applyCodeActionSchema>
): Promise<{ success: boolean; changes?: FileEdit[]; message?: string }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const range = new vscode.Range(
        new vscode.Position(params.startLine, params.startCharacter),
        new vscode.Position(params.endLine, params.endCharacter)
    );

    const actions = await vscode.commands.executeCommand<(vscode.Command | vscode.CodeAction)[]>(
        'vscode.executeCodeActionProvider',
        uri,
        range,
        params.kind
    );

    if (!actions || actions.length === 0) {
        return {
            success: false,
            message: 'No code actions available for this range',
        };
    }

    // Find the action with matching title
    const action = actions.find((a) => a.title === params.actionTitle);

    if (!action) {
        const availableTitles = actions.map((a) => a.title).join(', ');
        return {
            success: false,
            message: `Code action "${params.actionTitle}" not found. Available actions: ${availableTitles}`,
        };
    }

    // Handle Command type actions
    if ('command' in action && typeof action.command === 'string') {
        // It's a Command - we can't preview these, and applying them might not be edit-based
        if (params.dryRun) {
            return {
                success: false,
                message: `Cannot preview command-based action "${params.actionTitle}". Command actions cannot be dry-run.`,
            };
        }

        // Execute the command
        await vscode.commands.executeCommand(action.command, ...(action.arguments || []));
        return {
            success: true,
            message: `Executed command action "${params.actionTitle}"`,
        };
    }

    // Handle CodeAction type with edit
    if ('kind' in action && action.edit) {
        const workspaceEdit = action.edit;
        const entries = workspaceEdit.entries();

        if (entries.length === 0) {
            return {
                success: false,
                message: 'Code action has no edits to apply',
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
                message: `Dry-run: Would apply code action in ${fileEdits.length} file(s) with ${totalEdits} change(s)`,
            };
        }

        // Apply the edits
        const applied = await vscode.workspace.applyEdit(workspaceEdit);

        if (applied) {
            // Execute associated command if present
            if (action.command) {
                await vscode.commands.executeCommand(
                    action.command.command,
                    ...(action.command.arguments || [])
                );
            }

            return {
                success: true,
                changes: fileEdits,
                message: `Successfully applied code action in ${fileEdits.length} file(s) with ${totalEdits} change(s)`,
            };
        } else {
            return {
                success: false,
                message: 'Failed to apply code action edits',
            };
        }
    }

    return {
        success: false,
        message: 'Code action format not recognized',
    };
}
