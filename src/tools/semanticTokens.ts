import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const semanticTokensSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface SemanticToken {
    line: number;
    startChar: number;
    length: number;
    tokenType: string;
    tokenModifiers: string[];
}

export async function getSemanticTokens(
    params: z.infer<typeof semanticTokensSchema>
): Promise<{ tokens: SemanticToken[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    const document = await ensureDocumentOpen(uri);

    const semanticTokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        uri
    );

    if (!semanticTokens || !semanticTokens.data || semanticTokens.data.length === 0) {
        return { tokens: [] };
    }

    // Get the legend to decode token types and modifiers
    const legend = await getSemanticTokensLegend(uri);

    if (!legend) {
        return { tokens: [] };
    }

    // Decode the semantic tokens
    const tokens: SemanticToken[] = [];
    const data = semanticTokens.data;

    let currentLine = 0;
    let currentChar = 0;

    // Tokens are encoded as arrays of 5 integers per token:
    // [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaStartChar = data[i + 1];
        const length = data[i + 2];
        const tokenTypeIndex = data[i + 3];
        const tokenModifiersBitmap = data[i + 4];

        // Update position
        currentLine += deltaLine;
        if (deltaLine === 0) {
            currentChar += deltaStartChar;
        } else {
            currentChar = deltaStartChar;
        }

        // Decode token type
        const tokenType = legend.tokenTypes[tokenTypeIndex] || 'unknown';

        // Decode token modifiers
        const tokenModifiers: string[] = [];
        for (let modifierIndex = 0; modifierIndex < legend.tokenModifiers.length; modifierIndex++) {
            if (tokenModifiersBitmap & (1 << modifierIndex)) {
                tokenModifiers.push(legend.tokenModifiers[modifierIndex]);
            }
        }

        tokens.push({
            line: currentLine,
            startChar: currentChar,
            length,
            tokenType,
            tokenModifiers,
        });
    }

    return { tokens };
}

async function getSemanticTokensLegend(
    uri: vscode.Uri
): Promise<vscode.SemanticTokensLegend | undefined> {
    try {
        const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
            'vscode.provideDocumentSemanticTokensLegend',
            uri
        );
        return legend;
    } catch (error) {
        // If legend is not available, return undefined
        return undefined;
    }
}
