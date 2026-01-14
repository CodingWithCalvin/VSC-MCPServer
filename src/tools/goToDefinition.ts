import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const goToDefinitionSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
});

export interface DefinitionLocation {
    uri: string;
    range: Range;
    targetUri?: string;
    targetRange?: Range;
    targetSelectionRange?: Range;
}

export async function goToDefinition(
    params: z.infer<typeof goToDefinitionSchema>
): Promise<{ definitions: DefinitionLocation[] }> {
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

    const locations = await vscode.commands.executeCommand<
        (vscode.Location | vscode.LocationLink)[]
    >('vscode.executeDefinitionProvider', uri, position);

    if (!locations || locations.length === 0) {
        return { definitions: [] };
    }

    return {
        definitions: locations.map((loc) => {
            if ('targetUri' in loc) {
                // LocationLink
                return {
                    uri: loc.targetUri.toString(),
                    range: rangeToJSON(loc.targetRange),
                    targetUri: loc.targetUri.toString(),
                    targetRange: rangeToJSON(loc.targetRange),
                    targetSelectionRange: rangeToJSON(loc.targetSelectionRange),
                };
            } else {
                // Location
                return {
                    uri: loc.uri.toString(),
                    range: rangeToJSON(loc.range),
                };
            }
        }),
    };
}
