import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

export const listDirectorySchema = z.object({
    directoryPath: z.string().describe('Absolute path to a directory'),
    maxDepth: z.number().optional().default(2).describe('Maximum recursion depth'),
    includeFiles: z.boolean().optional().default(true).describe('Include files in output'),
    includeDirectories: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include directories in output'),
    excludeHidden: z
        .boolean()
        .optional()
        .default(true)
        .describe('Exclude dotfiles / dot-directories (names starting with .)'),
    excludeGlobs: z
        .array(z.string())
        .optional()
        .default(['**/node_modules/**', '**/.git/**', '**/.venv/**'])
        .describe('Glob patterns to exclude (matched against path relative to directoryPath)'),
    maxEntries: z
        .number()
        .optional()
        .default(200)
        .describe('Maximum number of nodes returned (prevents huge responses)'),
});

export type DirectoryTreeNode =
    | { type: 'file'; name: string; path: string }
    | { type: 'directory'; name: string; path: string; children: DirectoryTreeNode[] };

type TraversalBudget = {
    remaining: number;
    truncated: boolean;
};

function toPosixPath(p: string): string {
    return p.split(path.sep).join('/');
}

function globToRegExp(glob: string): RegExp {
    // Minimal glob support for "**", "*", and "?" matched against posix paths.
    // This avoids adding extra deps (e.g. minimatch) while still being useful for common excludes.
    const segments = toPosixPath(glob).split('/');
    let regex = '^';

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;

        if (segment === '**') {
            if (isLast) {
                regex += '.*';
            } else {
                // Zero or more path segments, each ending with '/'
                regex += '(?:[^/]+/)*';
            }
            continue;
        }

        let part = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        part = part.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
        regex += part;

        if (!isLast) {
            regex += '/';
        }
    }

    regex += '$';
    return new RegExp(regex);
}

function isExcluded(relativePosixPath: string, excludeMatchers: RegExp[]): boolean {
    // Also try matching without a leading "./" if present.
    const rel = relativePosixPath.startsWith('./') ? relativePosixPath.slice(2) : relativePosixPath;
    const relWithSlash = rel.endsWith('/') ? rel : `${rel}/`;
    return excludeMatchers.some((re) => re.test(rel) || re.test(relWithSlash));
}

async function buildTree(
    absolutePath: string,
    depth: number,
    maxDepth: number,
    includeFiles: boolean,
    includeDirectories: boolean,
    rootAbsolutePath: string,
    excludeHidden: boolean,
    excludeMatchers: RegExp[],
    budget: TraversalBudget
): Promise<DirectoryTreeNode> {
    const stat = await fs.stat(absolutePath);
    const name = path.basename(absolutePath);

    if (!stat.isDirectory()) {
        return { type: 'file', name, path: absolutePath };
    }

    const children: DirectoryTreeNode[] = [];
    if (depth < maxDepth) {
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            if (budget.remaining <= 0) {
                budget.truncated = true;
                break;
            }

            if (excludeHidden && entry.name.startsWith('.')) {
                continue;
            }

            const childPath = path.join(absolutePath, entry.name);
            const relativePosixPath = toPosixPath(path.relative(rootAbsolutePath, childPath));
            if (isExcluded(relativePosixPath, excludeMatchers)) {
                continue;
            }

            if (entry.isDirectory()) {
                if (!includeDirectories) {
                    continue;
                }
                budget.remaining -= 1;
                children.push(
                    await buildTree(
                        childPath,
                        depth + 1,
                        maxDepth,
                        includeFiles,
                        includeDirectories,
                        rootAbsolutePath,
                        excludeHidden,
                        excludeMatchers,
                        budget
                    )
                );
            } else if (entry.isFile()) {
                if (!includeFiles) {
                    continue;
                }
                budget.remaining -= 1;
                children.push({ type: 'file', name: entry.name, path: childPath });
            }
        }
    }

    return { type: 'directory', name, path: absolutePath, children };
}

export async function listDirectory(
    params: z.infer<typeof listDirectorySchema>
): Promise<{
    success: boolean;
    tree?: DirectoryTreeNode;
    truncated?: boolean;
    message?: string;
}> {
    try {
        const absolutePath = path.resolve(params.directoryPath);
        const excludeMatchers = (params.excludeGlobs || []).map(globToRegExp);
        const budget: TraversalBudget = { remaining: Math.max(0, params.maxEntries), truncated: false };
        const tree = await buildTree(
            absolutePath,
            0,
            params.maxDepth,
            params.includeFiles,
            params.includeDirectories,
            absolutePath,
            params.excludeHidden,
            excludeMatchers,
            budget
        );
        return { success: true, tree, truncated: budget.truncated };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}

