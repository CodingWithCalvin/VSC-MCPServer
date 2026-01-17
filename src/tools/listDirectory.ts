import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

export const listDirectorySchema = z.object({
    directoryPath: z.string().describe('Absolute path to a directory'),
    maxDepth: z.number().optional().default(4).describe('Maximum recursion depth'),
    includeFiles: z.boolean().optional().default(true).describe('Include files in output'),
    includeDirectories: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include directories in output'),
});

export type DirectoryTreeNode =
    | { type: 'file'; name: string; path: string }
    | { type: 'directory'; name: string; path: string; children: DirectoryTreeNode[] };

async function buildTree(
    absolutePath: string,
    depth: number,
    maxDepth: number,
    includeFiles: boolean,
    includeDirectories: boolean
): Promise<DirectoryTreeNode> {
    const stat = await fs.stat(absolutePath);
    const name = path.basename(absolutePath);

    if (!stat.isDirectory()) {
        return { type: 'file', name, path: absolutePath };
    }

    const children: DirectoryTreeNode[] = [];
    if (depth < maxDepth) {
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        for (const entry of entries) {
            const childPath = path.join(absolutePath, entry.name);
            if (entry.isDirectory()) {
                if (!includeDirectories) {
                    continue;
                }
                children.push(
                    await buildTree(
                        childPath,
                        depth + 1,
                        maxDepth,
                        includeFiles,
                        includeDirectories
                    )
                );
            } else if (entry.isFile()) {
                if (!includeFiles) {
                    continue;
                }
                children.push({ type: 'file', name: entry.name, path: childPath });
            }
        }
    }

    return { type: 'directory', name, path: absolutePath, children };
}

export async function listDirectory(
    params: z.infer<typeof listDirectorySchema>
): Promise<{ success: boolean; tree?: DirectoryTreeNode; message?: string }> {
    try {
        const absolutePath = path.resolve(params.directoryPath);
        const tree = await buildTree(
            absolutePath,
            0,
            params.maxDepth,
            params.includeFiles,
            params.includeDirectories
        );
        return { success: true, tree };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}

