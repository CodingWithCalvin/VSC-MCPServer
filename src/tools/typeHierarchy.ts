import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, symbolKindToString, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const typeHierarchySchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
    direction: z
        .enum(['supertypes', 'subtypes'])
        .describe('Get supertypes (parents/base classes) or subtypes (children/implementations)'),
});

export interface TypeHierarchyItemInfo {
    name: string;
    kind: string;
    uri: string;
    range: Range;
    selectionRange: Range;
    detail?: string;
}

export async function getTypeHierarchy(
    params: z.infer<typeof typeHierarchySchema>
): Promise<{ items: TypeHierarchyItemInfo[] }> {
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

    // First, prepare the type hierarchy
    const items = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
        'vscode.prepareTypeHierarchy',
        uri,
        position
    );

    if (!items || items.length === 0) {
        return { items: [] };
    }

    // Get supertypes or subtypes based on direction
    const hierarchyItems: vscode.TypeHierarchyItem[] = [];

    for (const item of items) {
        const relatedItems = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
            params.direction === 'supertypes'
                ? 'vscode.provideSupertypes'
                : 'vscode.provideSubtypes',
            item
        );

        if (relatedItems) {
            hierarchyItems.push(...relatedItems);
        }
    }

    const result: TypeHierarchyItemInfo[] = hierarchyItems.map((item) => ({
        name: item.name,
        kind: symbolKindToString(item.kind),
        uri: item.uri.toString(),
        range: rangeToJSON(item.range),
        selectionRange: rangeToJSON(item.selectionRange),
        detail: item.detail,
    }));

    return { items: result };
}
