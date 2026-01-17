import * as vscode from 'vscode';
import { z } from 'zod';
import { Range, rangeToJSON } from '../adapters/vscodeAdapter';
import { getConfiguration } from '../config/settings';

export const workspaceTextSearchSchema = z.object({
    query: z.string().describe('Text or regex pattern to search for'),
    isRegex: z.boolean().optional().describe('Whether the query is a regular expression (default: false)'),
    isCaseSensitive: z
        .boolean()
        .optional()
        .describe('Whether the search is case sensitive (default: false)'),
    includePattern: z
        .string()
        .optional()
        .describe('Glob pattern for files to include (e.g., "**/*.ts")'),
    excludePattern: z
        .string()
        .optional()
        .describe('Glob pattern for files to exclude (e.g., "**/node_modules/**")'),
    maxResults: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 1000)'),
});

export interface TextSearchResult {
    uri: string;
    relativePath: string;
    matches: {
        range: Range;
        preview: string;
        lineNumber: number;
    }[];
}

type WorkspaceTextSearchResponse = {
    results: TextSearchResult[];
    backend: 'findTextInFiles' | 'fallback';
    warning?: string;
};

export async function searchWorkspaceText(
    params: z.infer<typeof workspaceTextSearchSchema>
): Promise<WorkspaceTextSearchResponse> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { results: [], backend: 'fallback' };
    }

    const config = getConfiguration();

    // Prefer findTextInFiles when enabled (fast), but gracefully fall back if unavailable.
    if (config.useFindTextInFiles && typeof vscode.workspace.findTextInFiles === 'function') {
        try {
            return await searchWithFindTextInFiles(params);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // If this API is blocked (proposed API) or otherwise unavailable, fall back.
            return await searchWithFallback(params, `findTextInFiles unavailable: ${message}`);
        }
    }

    return await searchWithFallback(
        params,
        config.useFindTextInFiles
            ? 'findTextInFiles not available in this VS Code build/session; using fallback search.'
            : 'useFindTextInFiles is disabled; using fallback search.'
    );
}

async function searchWithFindTextInFiles(
    params: z.infer<typeof workspaceTextSearchSchema>
): Promise<WorkspaceTextSearchResponse> {
    const maxResults = params.maxResults ?? 1000;

    const searchOptions: vscode.FindTextInFilesOptions = {
        maxResults,
        include: params.includePattern,
        exclude: params.excludePattern,
    };

    // Create a pattern with flags
    let pattern: string | RegExp = params.query;
    if (params.isRegex) {
        const flags = params.isCaseSensitive ? '' : 'i';
        pattern = new RegExp(params.query, flags);
    }

    const results: Map<string, TextSearchResult> = new Map();

    await vscode.workspace.findTextInFiles(
        {
            pattern,
            isCaseSensitive: params.isCaseSensitive ?? false,
            isRegExp: params.isRegex ?? false,
        },
        searchOptions,
        (result: vscode.TextSearchResult) => {
            const uri = result.uri.toString();

            if (!results.has(uri)) {
                results.set(uri, {
                    uri,
                    relativePath: vscode.workspace.asRelativePath(result.uri, false),
                    matches: [],
                });
            }

            const fileResult = results.get(uri)!;

            if ('ranges' in result) {
                // TextSearchMatch type
                for (const range of result.ranges) {
                    fileResult.matches.push({
                        range: rangeToJSON(range),
                        preview: result.preview.text,
                        lineNumber: range.start.line,
                    });
                }
            }
        }
    );

    return { results: Array.from(results.values()), backend: 'findTextInFiles' };
}

async function searchWithFallback(
    params: z.infer<typeof workspaceTextSearchSchema>,
    warning?: string
): Promise<WorkspaceTextSearchResponse> {
    const maxResults = params.maxResults ?? 1000;
    const isCaseSensitive = params.isCaseSensitive ?? false;
    const isRegex = params.isRegex ?? false;

    // Find candidate files
    const include = params.includePattern ?? '**/*';
    const exclude = params.excludePattern;

    const files = await vscode.workspace.findFiles(include, exclude, Math.max(1000, maxResults));

    const results: Map<string, TextSearchResult> = new Map();
    let totalMatches = 0;

    const textDecoder = new TextDecoder('utf-8');

    const regex = isRegex
        ? new RegExp(params.query, `${isCaseSensitive ? '' : 'i'}g`)
        : undefined;
    const needle = isRegex
        ? undefined
        : isCaseSensitive
            ? params.query
            : params.query.toLowerCase();

    for (const uri of files) {
        if (totalMatches >= maxResults) break;

        let text: string;
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            text = textDecoder.decode(bytes);
        } catch {
            // Ignore unreadable/binary files
            continue;
        }

        const lines = text.split(/\r?\n/);

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            if (totalMatches >= maxResults) break;

            const line = lines[lineNumber];

            if (regex) {
                regex.lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = regex.exec(line)) !== null) {
                    const start = match.index;
                    const length = match[0]?.length ?? 0;
                    const end = start + length;

                    pushMatch(results, uri, lineNumber, start, end, line);
                    totalMatches++;

                    if (totalMatches >= maxResults) break;

                    // Avoid infinite loops on zero-length matches
                    if (length === 0) {
                        regex.lastIndex++;
                    }
                }
            } else if (needle) {
                const haystack = isCaseSensitive ? line : line.toLowerCase();
                let idx = 0;
                while (true) {
                    const found = haystack.indexOf(needle, idx);
                    if (found === -1) break;

                    const start = found;
                    const end = found + needle.length;

                    pushMatch(results, uri, lineNumber, start, end, line);
                    totalMatches++;

                    if (totalMatches >= maxResults) break;

                    idx = Math.max(end, found + 1);
                }
            }
        }
    }

    return {
        results: Array.from(results.values()),
        backend: 'fallback',
        warning,
    };
}

function pushMatch(
    results: Map<string, TextSearchResult>,
    uri: vscode.Uri,
    lineNumber: number,
    startCharacter: number,
    endCharacter: number,
    previewLine: string
): void {
    const uriString = uri.toString();

    if (!results.has(uriString)) {
        results.set(uriString, {
            uri: uriString,
            relativePath: vscode.workspace.asRelativePath(uri, false),
            matches: [],
        });
    }

    const fileResult = results.get(uriString)!;

    fileResult.matches.push({
        range: {
            startLine: lineNumber,
            startCharacter,
            endLine: lineNumber,
            endCharacter,
        },
        preview: previewLine,
        lineNumber,
    });
}
