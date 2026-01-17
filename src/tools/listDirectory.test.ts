import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';

import { listDirectory, listDirectorySchema } from './listDirectory';

describe('list_directory', () => {
    it('returns a directory tree', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-listdir-'));
        await mkdir(path.join(root, 'sub'));
        await writeFile(path.join(root, 'a.txt'), 'hello', 'utf8');
        await writeFile(path.join(root, 'sub', 'b.txt'), 'world', 'utf8');

        const result = await listDirectory(
            listDirectorySchema.parse({ directoryPath: root, maxDepth: 2 })
        );

        expect(result.success).toBe(true);
        expect(result.tree?.type).toBe('directory');
        const children = (result.tree as any).children as any[];
        expect(children.some((c) => c.name === 'a.txt')).toBe(true);
        expect(children.some((c) => c.name === 'sub')).toBe(true);
    });
});

