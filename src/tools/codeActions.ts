import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const codeActionsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    startLine: z.number().describe('0-indexed start line number'),
    startCharacter: z.number().describe('0-indexed start character position'),
    endLine: z.number().describe('0-indexed end line number'),
    endCharacter: z.number().describe('0-indexed end character position'),
    kind: z
        .string()
        .optional()
        .describe('Filter by action kind (e.g., "quickfix", "refactor", "source")'),
});

export interface CodeActionInfo {
    title: string;
    kind?: string;
    diagnostics?: string[];
    isPreferred?: boolean;
    disabled?: string;
}

export async function getCodeActions(
    params: z.infer<typeof codeActionsSchema>
): Promise<{ actions: CodeActionInfo[] }> {
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
        return { actions: [] };
    }

    const result: CodeActionInfo[] = [];

    for (const action of actions) {
        // Handle both Command and CodeAction types
        if ('kind' in action) {
            // It's a CodeAction
            result.push({
                title: action.title,
                kind: action.kind?.value,
                diagnostics: action.diagnostics?.map((d) => d.message),
                isPreferred: action.isPreferred,
                disabled: action.disabled?.reason,
            });
        } else {
            // It's a Command
            result.push({
                title: action.title,
            });
        }
    }

    return { actions: result };
}
