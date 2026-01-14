import * as vscode from 'vscode';
import { z } from 'zod';

export const workspaceFileSearchSchema = z.object({
    pattern: z.string().describe('Glob pattern to search for files (e.g., "**/*.ts", "test/**")'),
    maxResults: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 1000)'),
    exclude: z
        .string()
        .optional()
        .describe('Glob pattern for files to exclude (e.g., "**/node_modules/**")'),
});

export interface FileSearchResult {
    uri: string;
    relativePath: string;
}

export async function searchWorkspaceFiles(
    params: z.infer<typeof workspaceFileSearchSchema>
): Promise<{ files: FileSearchResult[] }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { files: [] };
    }

    const options: vscode.FindFilesOptions = {
        maxResults: params.maxResults || 1000,
    };

    const excludePattern = params.exclude || undefined;

    const files = await vscode.workspace.findFiles(
        params.pattern,
        excludePattern,
        options.maxResults
    );

    const result: FileSearchResult[] = files.map((uri) => {
        // Get relative path from workspace root
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        return {
            uri: uri.toString(),
            relativePath,
        };
    });

    return { files: result };
}
