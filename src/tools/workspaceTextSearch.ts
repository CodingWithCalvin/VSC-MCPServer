import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range } from '../adapters/vscodeAdapter';

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

export async function searchWorkspaceText(
    params: z.infer<typeof workspaceTextSearchSchema>
): Promise<{ results: TextSearchResult[] }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { results: [] };
    }

    // Build the search query
    const searchOptions: vscode.FindTextInFilesOptions = {
        maxResults: params.maxResults || 1000,
        include: params.includePattern,
        exclude: params.excludePattern,
    };

    // Create a pattern with flags
    let pattern: string | RegExp = params.query;
    if (params.isRegex) {
        const flags = params.isCaseSensitive ? '' : 'i';
        pattern = new RegExp(params.query, flags);
    }

    // Perform the search
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

            // Add matches from this result
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

    return { results: Array.from(results.values()) };
}
