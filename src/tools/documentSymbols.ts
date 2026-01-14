import * as vscode from 'vscode';
import { z } from 'zod';
import {
    SymbolInfo,
    documentSymbolToInfo,
    symbolInformationToInfo,
    ensureDocumentOpen,
} from '../adapters/vscodeAdapter';

export const documentSymbolsSchema = z.object({
    uri: z.string().describe('File URI (file:///path/to/file.ts) or absolute file path'),
    query: z.string().optional().describe('Optional filter query to match symbol names'),
});

export async function getDocumentSymbols(
    params: z.infer<typeof documentSymbolsSchema>
): Promise<{ symbols: SymbolInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open (triggers language server)
    await ensureDocumentOpen(uri);

    const symbols = await vscode.commands.executeCommand<
        (vscode.SymbolInformation | vscode.DocumentSymbol)[]
    >('vscode.executeDocumentSymbolProvider', uri);

    if (!symbols || symbols.length === 0) {
        return { symbols: [] };
    }

    // Convert to our format
    let result: SymbolInfo[] = symbols.map((symbol) => {
        if ('children' in symbol) {
            // DocumentSymbol
            return documentSymbolToInfo(symbol);
        } else {
            // SymbolInformation
            return symbolInformationToInfo(symbol);
        }
    });

    // Apply filter if provided
    if (params.query) {
        const query = params.query.toLowerCase();
        result = filterSymbols(result, query);
    }

    return { symbols: result };
}

function filterSymbols(symbols: SymbolInfo[], query: string): SymbolInfo[] {
    const filtered: SymbolInfo[] = [];

    for (const symbol of symbols) {
        const matches = symbol.name.toLowerCase().includes(query);
        const filteredChildren = symbol.children
            ? filterSymbols(symbol.children, query)
            : [];

        if (matches || filteredChildren.length > 0) {
            filtered.push({
                ...symbol,
                children: filteredChildren.length > 0 ? filteredChildren : undefined,
            });
        }
    }

    return filtered;
}
