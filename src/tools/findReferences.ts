import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const findReferencesSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
    includeDeclaration: z.boolean().optional().default(true).describe('Include the declaration in results'),
});

export interface ReferenceLocation {
    uri: string;
    range: Range;
}

export async function findReferences(
    params: z.infer<typeof findReferencesSchema>
): Promise<{ references: ReferenceLocation[]; totalCount: number }> {
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

    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        uri,
        position
    );

    if (!locations || locations.length === 0) {
        return { references: [], totalCount: 0 };
    }

    return {
        references: locations.map((loc) => ({
            uri: loc.uri.toString(),
            range: rangeToJSON(loc.range),
        })),
        totalCount: locations.length,
    };
}
