import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const documentHighlightsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
});

export interface DocumentHighlightInfo {
    range: Range;
    kind: string;
}

export async function getDocumentHighlights(
    params: z.infer<typeof documentHighlightsSchema>
): Promise<{ highlights: DocumentHighlightInfo[] }> {
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

    const highlights = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
        'vscode.executeDocumentHighlights',
        uri,
        position
    );

    if (!highlights || highlights.length === 0) {
        return { highlights: [] };
    }

    const result: DocumentHighlightInfo[] = highlights.map((hl) => ({
        range: rangeToJSON(hl.range),
        kind: highlightKindToString(hl.kind),
    }));

    return { highlights: result };
}

function highlightKindToString(kind: vscode.DocumentHighlightKind | undefined): string {
    switch (kind) {
        case vscode.DocumentHighlightKind.Text:
            return 'Text';
        case vscode.DocumentHighlightKind.Read:
            return 'Read';
        case vscode.DocumentHighlightKind.Write:
            return 'Write';
        default:
            return 'Unknown';
    }
}
