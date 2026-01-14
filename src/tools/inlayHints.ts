import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const inlayHintsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    startLine: z.number().describe('0-indexed start line number'),
    startCharacter: z.number().describe('0-indexed start character position'),
    endLine: z.number().describe('0-indexed end line number'),
    endCharacter: z.number().describe('0-indexed end character position'),
});

export interface InlayHintInfo {
    position: { line: number; character: number };
    label: string;
    kind: string;
    tooltip?: string;
    paddingLeft?: boolean;
    paddingRight?: boolean;
}

export async function getInlayHints(
    params: z.infer<typeof inlayHintsSchema>
): Promise<{ hints: InlayHintInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const range = new vscode.Range(
        new vscode.Position(params.startLine, params.startCharacter),
        new vscode.Position(params.endLine, params.endCharacter)
    );

    const hints = await vscode.commands.executeCommand<vscode.InlayHint[]>(
        'vscode.executeInlayHintProvider',
        uri,
        range
    );

    if (!hints || hints.length === 0) {
        return { hints: [] };
    }

    const result: InlayHintInfo[] = hints.map((hint) => ({
        position: {
            line: hint.position.line,
            character: hint.position.character,
        },
        label: getLabelString(hint.label),
        kind: inlayHintKindToString(hint.kind),
        tooltip: getTooltipString(hint.tooltip),
        paddingLeft: hint.paddingLeft,
        paddingRight: hint.paddingRight,
    }));

    return { hints: result };
}

function getLabelString(label: string | vscode.InlayHintLabelPart[]): string {
    if (typeof label === 'string') return label;
    return label.map((part) => part.value).join('');
}

function getTooltipString(
    tooltip: string | vscode.MarkdownString | undefined
): string | undefined {
    if (!tooltip) return undefined;
    if (typeof tooltip === 'string') return tooltip;
    return tooltip.value;
}

function inlayHintKindToString(kind: vscode.InlayHintKind | undefined): string {
    switch (kind) {
        case vscode.InlayHintKind.Type:
            return 'Type';
        case vscode.InlayHintKind.Parameter:
            return 'Parameter';
        default:
            return 'Unknown';
    }
}
