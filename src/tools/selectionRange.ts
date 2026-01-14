import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const selectionRangeSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
});

export interface SelectionRangeInfo {
    range: Range;
    parent?: SelectionRangeInfo;
}

export async function getSelectionRange(
    params: z.infer<typeof selectionRangeSchema>
): Promise<{ ranges: SelectionRangeInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const position = new vscode.Position(params.line, params.character);

    const selectionRanges = await vscode.commands.executeCommand<vscode.SelectionRange[]>(
        'vscode.executeSelectionRangeProvider',
        uri,
        [position]
    );

    if (!selectionRanges || selectionRanges.length === 0) {
        return { ranges: [] };
    }

    const result: SelectionRangeInfo[] = selectionRanges.map((selRange) =>
        convertSelectionRange(selRange)
    );

    return { ranges: result };
}

function convertSelectionRange(selRange: vscode.SelectionRange): SelectionRangeInfo {
    return {
        range: rangeToJSON(selRange.range),
        parent: selRange.parent ? convertSelectionRange(selRange.parent) : undefined,
    };
}
