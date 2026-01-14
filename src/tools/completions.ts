import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const completionsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
    triggerCharacter: z.string().optional().describe('Character that triggered completion (e.g., ".", "::", "->")'),
});

export interface CompletionItemInfo {
    label: string;
    kind: string;
    detail?: string;
    documentation?: string;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    range?: Range;
}

export async function getCompletions(
    params: z.infer<typeof completionsSchema>
): Promise<{ items: CompletionItemInfo[] }> {
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

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        uri,
        position,
        params.triggerCharacter
    );

    if (!completions || completions.items.length === 0) {
        return { items: [] };
    }

    const items: CompletionItemInfo[] = completions.items.map((item) => ({
        label: typeof item.label === 'string' ? item.label : item.label.label,
        kind: completionKindToString(item.kind),
        detail: item.detail,
        documentation: getDocumentationString(item.documentation),
        sortText: item.sortText,
        filterText: item.filterText,
        insertText: typeof item.insertText === 'string' ? item.insertText : undefined,
        range: item.range
            ? item.range instanceof vscode.Range
                ? rangeToJSON(item.range)
                : rangeToJSON(item.range.inserting)
            : undefined,
    }));

    return { items };
}

function completionKindToString(kind: vscode.CompletionItemKind | undefined): string {
    if (kind === undefined) return 'Unknown';

    const kindNames: Record<vscode.CompletionItemKind, string> = {
        [vscode.CompletionItemKind.Text]: 'Text',
        [vscode.CompletionItemKind.Method]: 'Method',
        [vscode.CompletionItemKind.Function]: 'Function',
        [vscode.CompletionItemKind.Constructor]: 'Constructor',
        [vscode.CompletionItemKind.Field]: 'Field',
        [vscode.CompletionItemKind.Variable]: 'Variable',
        [vscode.CompletionItemKind.Class]: 'Class',
        [vscode.CompletionItemKind.Interface]: 'Interface',
        [vscode.CompletionItemKind.Module]: 'Module',
        [vscode.CompletionItemKind.Property]: 'Property',
        [vscode.CompletionItemKind.Unit]: 'Unit',
        [vscode.CompletionItemKind.Value]: 'Value',
        [vscode.CompletionItemKind.Enum]: 'Enum',
        [vscode.CompletionItemKind.Keyword]: 'Keyword',
        [vscode.CompletionItemKind.Snippet]: 'Snippet',
        [vscode.CompletionItemKind.Color]: 'Color',
        [vscode.CompletionItemKind.File]: 'File',
        [vscode.CompletionItemKind.Reference]: 'Reference',
        [vscode.CompletionItemKind.Folder]: 'Folder',
        [vscode.CompletionItemKind.EnumMember]: 'EnumMember',
        [vscode.CompletionItemKind.Constant]: 'Constant',
        [vscode.CompletionItemKind.Struct]: 'Struct',
        [vscode.CompletionItemKind.Event]: 'Event',
        [vscode.CompletionItemKind.Operator]: 'Operator',
        [vscode.CompletionItemKind.TypeParameter]: 'TypeParameter',
    };

    return kindNames[kind] || 'Unknown';
}

function getDocumentationString(
    doc: string | vscode.MarkdownString | undefined
): string | undefined {
    if (!doc) return undefined;
    if (typeof doc === 'string') return doc;
    return doc.value;
}
