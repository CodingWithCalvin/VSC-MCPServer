import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const hoverInfoSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
});

export interface HoverContent {
    value: string;
    language?: string;
}

export async function getHoverInfo(
    params: z.infer<typeof hoverInfoSchema>
): Promise<{ contents: HoverContent[]; range?: Range }> {
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

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        uri,
        position
    );

    if (!hovers || hovers.length === 0) {
        return { contents: [] };
    }

    const contents: HoverContent[] = [];

    for (const hover of hovers) {
        for (const content of hover.contents) {
            if (typeof content === 'string') {
                contents.push({ value: content });
            } else if (content instanceof vscode.MarkdownString) {
                contents.push({ value: content.value, language: 'markdown' });
            } else if ('value' in content) {
                // MarkdownString-like object or {language, value}
                contents.push({
                    value: content.value,
                    language: 'language' in content ? content.language : 'markdown',
                });
            }
        }
    }

    return {
        contents,
        range: hovers[0].range ? rangeToJSON(hovers[0].range) : undefined,
    };
}
