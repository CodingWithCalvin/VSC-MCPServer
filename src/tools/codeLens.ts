import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const codeLensSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface CodeLensInfo {
    range: Range;
    command?: {
        title: string;
        command: string;
        tooltip?: string;
    };
}

export async function getCodeLens(
    params: z.infer<typeof codeLensSchema>
): Promise<{ lenses: CodeLensInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
        'vscode.executeCodeLensProvider',
        uri
    );

    if (!codeLenses || codeLenses.length === 0) {
        return { lenses: [] };
    }

    const result: CodeLensInfo[] = codeLenses.map((lens) => ({
        range: rangeToJSON(lens.range),
        command: lens.command
            ? {
                  title: lens.command.title,
                  command: lens.command.command,
                  tooltip: lens.command.tooltip,
              }
            : undefined,
    }));

    return { lenses: result };
}
