import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, symbolKindToString, Range } from '../adapters/vscodeAdapter';

export const workspaceSymbolsSchema = z.object({
    query: z.string().describe('Symbol name search query'),
    maxResults: z.number().optional().default(50).describe('Maximum number of results'),
});

export interface WorkspaceSymbol {
    name: string;
    kind: string;
    uri: string;
    range: Range;
    containerName?: string;
}

export async function getWorkspaceSymbols(
    params: z.infer<typeof workspaceSymbolsSchema>
): Promise<{ symbols: WorkspaceSymbol[]; totalCount: number }> {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        params.query
    );

    if (!symbols || symbols.length === 0) {
        return { symbols: [], totalCount: 0 };
    }

    const totalCount = symbols.length;
    const limitedSymbols = symbols.slice(0, params.maxResults);

    return {
        symbols: limitedSymbols.map((s) => ({
            name: s.name,
            kind: symbolKindToString(s.kind),
            uri: s.location.uri.toString(),
            range: rangeToJSON(s.location.range),
            containerName: s.containerName || undefined,
        })),
        totalCount,
    };
}
