import * as vscode from 'vscode';

export interface Range {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
}

export interface SymbolInfo {
    name: string;
    kind: string;
    range: Range;
    containerName?: string;
    children?: SymbolInfo[];
}

export interface Location {
    uri: string;
    range: Range;
}

export interface DiagnosticInfo {
    uri: string;
    severity: string;
    message: string;
    range: Range;
    source?: string;
    code?: string | number;
}

export function rangeToJSON(range: vscode.Range): Range {
    return {
        startLine: range.start.line,
        startCharacter: range.start.character,
        endLine: range.end.line,
        endCharacter: range.end.character,
    };
}

export function symbolKindToString(kind: vscode.SymbolKind): string {
    const kindNames: Record<vscode.SymbolKind, string> = {
        [vscode.SymbolKind.File]: 'File',
        [vscode.SymbolKind.Module]: 'Module',
        [vscode.SymbolKind.Namespace]: 'Namespace',
        [vscode.SymbolKind.Package]: 'Package',
        [vscode.SymbolKind.Class]: 'Class',
        [vscode.SymbolKind.Method]: 'Method',
        [vscode.SymbolKind.Property]: 'Property',
        [vscode.SymbolKind.Field]: 'Field',
        [vscode.SymbolKind.Constructor]: 'Constructor',
        [vscode.SymbolKind.Enum]: 'Enum',
        [vscode.SymbolKind.Interface]: 'Interface',
        [vscode.SymbolKind.Function]: 'Function',
        [vscode.SymbolKind.Variable]: 'Variable',
        [vscode.SymbolKind.Constant]: 'Constant',
        [vscode.SymbolKind.String]: 'String',
        [vscode.SymbolKind.Number]: 'Number',
        [vscode.SymbolKind.Boolean]: 'Boolean',
        [vscode.SymbolKind.Array]: 'Array',
        [vscode.SymbolKind.Object]: 'Object',
        [vscode.SymbolKind.Key]: 'Key',
        [vscode.SymbolKind.Null]: 'Null',
        [vscode.SymbolKind.EnumMember]: 'EnumMember',
        [vscode.SymbolKind.Struct]: 'Struct',
        [vscode.SymbolKind.Event]: 'Event',
        [vscode.SymbolKind.Operator]: 'Operator',
        [vscode.SymbolKind.TypeParameter]: 'TypeParameter',
    };
    return kindNames[kind] || 'Unknown';
}

export function diagnosticSeverityToString(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error:
            return 'Error';
        case vscode.DiagnosticSeverity.Warning:
            return 'Warning';
        case vscode.DiagnosticSeverity.Information:
            return 'Information';
        case vscode.DiagnosticSeverity.Hint:
            return 'Hint';
        default:
            return 'Unknown';
    }
}

export function documentSymbolToInfo(symbol: vscode.DocumentSymbol): SymbolInfo {
    return {
        name: symbol.name,
        kind: symbolKindToString(symbol.kind),
        range: rangeToJSON(symbol.range),
        children: symbol.children?.map(documentSymbolToInfo),
    };
}

export function symbolInformationToInfo(symbol: vscode.SymbolInformation): SymbolInfo {
    return {
        name: symbol.name,
        kind: symbolKindToString(symbol.kind),
        range: rangeToJSON(symbol.location.range),
        containerName: symbol.containerName,
    };
}

export async function ensureDocumentOpen(uri: vscode.Uri): Promise<vscode.TextDocument> {
    try {
        // Try to get already open document
        const openDoc = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.toString() === uri.toString()
        );
        if (openDoc) {
            return openDoc;
        }

        // Open the document (doesn't show it in editor)
        return await vscode.workspace.openTextDocument(uri);
    } catch (error) {
        throw new Error(`Failed to open document: ${uri.toString()}`);
    }
}
