import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, ensureDocumentOpen } from '../adapters/vscodeAdapter';
import { getConfiguration } from '../config/settings';
import { saveUris } from '../utils/autoSave';

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
): Promise<{
    success: boolean;
    applied?: boolean;
    saved?: boolean;
    changes?: FileEdit[];
    message?: string;
}> {
    const config = getConfiguration();

    // Handle both file:// URIs and plain paths
    const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

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

    // vscode.executeCodeActionProvider can return either a Command or a CodeAction.
    // - Command: { title, command: string, arguments?: any[] }
    // - CodeAction: may have edit and/or command (Command object)

    // Handle Command type actions
    if (!('kind' in action)) {
        const commandAction = action as vscode.Command;

        if (params.dryRun) {
            return {
                success: false,
                message: `Cannot preview command-based action "${params.actionTitle}". Command actions cannot be dry-run.`,
            };
        }

        await vscode.commands.executeCommand(
            commandAction.command,
            ...(commandAction.arguments || [])
        );
        return {
            success: true,
            applied: true,
            saved: false,
            message: `Executed command action "${params.actionTitle}"`,
        };
    }

    // Handle CodeAction
    const codeAction = action as vscode.CodeAction;

    // If the action has edits, we can preview/apply them.
    if (codeAction.edit) {
        const workspaceEdit = codeAction.edit;
        const entries = workspaceEdit.entries();

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

        if (params.dryRun) {
            return {
                success: true,
                applied: false,
                saved: false,
                changes: fileEdits,
                message: `Dry-run: Would apply code action in ${fileEdits.length} file(s) with ${totalEdits} change(s)`,
            };
        }

        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (!applied) {
            return {
                success: false,
                message: 'Failed to apply code action edits',
            };
        }

        // Auto-save files if enabled
        let saved = false;
        if (config.autoSaveAfterToolEdits) {
            const result = await saveUris(entries.map(([u]) => u));
            saved = result.failedUris.length === 0;
        }

        // Execute associated command if present
        if (codeAction.command) {
            await vscode.commands.executeCommand(
                codeAction.command.command,
                ...(codeAction.command.arguments || [])
            );
        }

        return {
            success: true,
            applied: true,
            saved,
            changes: fileEdits,
            message: `Successfully applied code action in ${fileEdits.length} file(s) with ${totalEdits} change(s)${
                config.autoSaveAfterToolEdits ? (saved ? ' (saved)' : ' (save failed)') : ''
            }`,
        };
    }

    // Some code actions are command-only (no WorkspaceEdit). We can execute but cannot preview.
    if (codeAction.command) {
        if (params.dryRun) {
            return {
                success: false,
                message: `Cannot preview code action "${params.actionTitle}" because it has no WorkspaceEdit (command-only action).`,
            };
        }

        await vscode.commands.executeCommand(
            codeAction.command.command,
            ...(codeAction.command.arguments || [])
        );

        return {
            success: true,
            applied: true,
            saved: false,
            message: `Executed code action "${params.actionTitle}" (command-only)`,
        };
    }

    return {
        success: false,
        message: 'Code action has neither edits nor an executable command',
    };
}
