import * as vscode from 'vscode';
import { z } from 'zod';
import { ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const signatureHelpSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
});

export interface ParameterInfo {
    label: string;
    documentation?: string;
}

export interface SignatureInfo {
    label: string;
    documentation?: string;
    parameters?: ParameterInfo[];
}

export async function getSignatureHelp(
    params: z.infer<typeof signatureHelpSchema>
): Promise<{
    signatures: SignatureInfo[];
    activeSignature?: number;
    activeParameter?: number;
}> {
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

    const signatureHelp = await vscode.commands.executeCommand<vscode.SignatureHelp>(
        'vscode.executeSignatureHelpProvider',
        uri,
        position
    );

    if (!signatureHelp || signatureHelp.signatures.length === 0) {
        return { signatures: [] };
    }

    const signatures: SignatureInfo[] = signatureHelp.signatures.map((sig) => ({
        label: sig.label,
        documentation: getDocString(sig.documentation),
        parameters: sig.parameters?.map((param) => ({
            label: getParameterLabel(param.label),
            documentation: getDocString(param.documentation),
        })),
    }));

    return {
        signatures,
        activeSignature: signatureHelp.activeSignature,
        activeParameter: signatureHelp.activeParameter,
    };
}

function getDocString(doc: string | vscode.MarkdownString | undefined): string | undefined {
    if (!doc) return undefined;
    if (typeof doc === 'string') return doc;
    return doc.value;
}

function getParameterLabel(label: string | [number, number]): string {
    if (typeof label === 'string') return label;
    // If it's a tuple representing character offsets, return a placeholder
    return `param[${label[0]}-${label[1]}]`;
}
