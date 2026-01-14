import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const foldingRangesSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface FoldingRangeInfo {
    start: number;
    end: number;
    kind?: string;
}

export async function getFoldingRanges(
    params: z.infer<typeof foldingRangesSchema>
): Promise<{ ranges: FoldingRangeInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
        'vscode.executeFoldingRangeProvider',
        uri
    );

    if (!ranges || ranges.length === 0) {
        return { ranges: [] };
    }

    const result: FoldingRangeInfo[] = ranges.map((range) => ({
        start: range.start,
        end: range.end,
        kind: foldingRangeKindToString(range.kind),
    }));

    return { ranges: result };
}

function foldingRangeKindToString(kind: vscode.FoldingRangeKind | undefined): string | undefined {
    if (!kind) return undefined;

    switch (kind) {
        case vscode.FoldingRangeKind.Comment:
            return 'Comment';
        case vscode.FoldingRangeKind.Imports:
            return 'Imports';
        case vscode.FoldingRangeKind.Region:
            return 'Region';
        default:
            return undefined;
    }
}
