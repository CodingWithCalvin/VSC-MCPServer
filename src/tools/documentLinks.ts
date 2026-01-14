import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const documentLinksSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface DocumentLinkInfo {
    range: Range;
    target?: string;
    tooltip?: string;
}

export async function getDocumentLinks(
    params: z.infer<typeof documentLinksSchema>
): Promise<{ links: DocumentLinkInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        'vscode.executeDocumentLinkProvider',
        uri
    );

    if (!links || links.length === 0) {
        return { links: [] };
    }

    const result: DocumentLinkInfo[] = links.map((link) => ({
        range: rangeToJSON(link.range),
        target: link.target?.toString(),
        tooltip: link.tooltip,
    }));

    return { links: result };
}
