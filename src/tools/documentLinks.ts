import * as vscode from 'vscode';
import path from 'path';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const documentLinksSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface DocumentLinkInfo {
    range: Range;
    target?: string;
    tooltip?: string;
}

const DOCUMENT_LINK_PROVIDER_COMMAND = 'vscode.executeDocumentLinkProvider';

async function hasDocumentLinkProviderCommand(): Promise<boolean> {
    try {
        const commands = await vscode.commands.getCommands(true);
        return commands.includes(DOCUMENT_LINK_PROVIDER_COMMAND);
    } catch {
        return false;
    }
}

function normalizeTarget(rawTarget: string, documentFsPath: string): string {
    const target = rawTarget.trim();
    if (!target) {
        return target;
    }

    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('file://')) {
        return target;
    }

    const match = target.match(/^([^#?]+)(.*)$/);
    const base = match?.[1] ?? target;
    const suffix = match?.[2] ?? '';

    if (path.isAbsolute(base)) {
        return vscode.Uri.file(base).toString() + suffix;
    }

    const resolved = path.join(path.dirname(documentFsPath), base);
    return vscode.Uri.file(resolved).toString() + suffix;
}

function extractFallbackLinks(document: vscode.TextDocument): DocumentLinkInfo[] {
    const text = document.getText();
    const links: DocumentLinkInfo[] = [];
    const seen = new Set<string>();

    const pushLink = (start: number, end: number, rawTarget: string, tooltip?: string) => {
        const key = `${start}:${end}:${rawTarget}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        const startPos = document.positionAt(start);
        const endPos = document.positionAt(end);
        const range = new vscode.Range(startPos as any, endPos as any);
        links.push({
            range: rangeToJSON(range as any),
            target: normalizeTarget(rawTarget, document.uri.fsPath),
            tooltip,
        });
    };

    // Markdown links: [text](target)
    const mdLinkRe = /\[[^\]]+\]\(([^)\s]+)\)/g;
    for (const match of text.matchAll(mdLinkRe)) {
        const full = match[0];
        const target = match[1];
        const fullIndex = match.index ?? -1;
        if (fullIndex < 0) {
            continue;
        }
        const targetIndex = full.lastIndexOf(target);
        if (targetIndex < 0) {
            continue;
        }
        const start = fullIndex + targetIndex;
        const end = start + target.length;
        pushLink(start, end, target, 'Parsed Markdown link');
    }

    // URLs in text
    const urlRe = /\bhttps?:\/\/[^\s<>()"']+/g;
    for (const match of text.matchAll(urlRe)) {
        const url = match[0];
        const start = match.index ?? -1;
        if (start < 0) {
            continue;
        }
        pushLink(start, start + url.length, url, 'Parsed URL');
    }

    return links;
}

export async function getDocumentLinks(
    params: z.infer<typeof documentLinksSchema>
): Promise<{
    links: DocumentLinkInfo[];
    provider?: 'vscode' | 'fallback';
    providerAvailable?: boolean;
    message?: string;
}> {
    try {
        // Handle file:// URIs, absolute paths, and workspace-relative paths
        let uri: vscode.Uri;
        if (params.uri.startsWith('file://')) {
            uri = vscode.Uri.parse(params.uri);
        } else if (path.isAbsolute(params.uri)) {
            uri = vscode.Uri.file(params.uri);
        } else {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const resolved = root ? path.join(root, params.uri) : path.resolve(params.uri);
            uri = vscode.Uri.file(resolved);
        }

        // Ensure document is open
        const document = await ensureDocumentOpen(uri);

        const providerAvailable = await hasDocumentLinkProviderCommand();
        if (!providerAvailable) {
            return {
                links: extractFallbackLinks(document),
                provider: 'fallback',
                providerAvailable: false,
                message: `command '${DOCUMENT_LINK_PROVIDER_COMMAND}' not found; used fallback parser`,
            };
        }

        let links: vscode.DocumentLink[] | undefined | null;
        try {
            links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
                DOCUMENT_LINK_PROVIDER_COMMAND,
                uri
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.toLowerCase().includes('not found')) {
                return {
                    links: extractFallbackLinks(document),
                    provider: 'fallback',
                    providerAvailable: false,
                    message: `command '${DOCUMENT_LINK_PROVIDER_COMMAND}' not found; used fallback parser`,
                };
            }
            throw error;
        }

        if (!links || links.length === 0) {
            return { links: [], provider: 'vscode', providerAvailable: true };
        }

        const result: DocumentLinkInfo[] = links.map((link) => ({
            range: rangeToJSON(link.range),
            target: link.target?.toString(),
            tooltip: link.tooltip,
        }));

        return { links: result, provider: 'vscode', providerAvailable: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { links: [], provider: 'fallback', providerAvailable: false, message: errorMessage };
    }
}
