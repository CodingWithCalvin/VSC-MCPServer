import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { searchWorkspaceFiles, workspaceFileSearchSchema } from './workspaceFileSearch';
import { mockVscode, resetMocks, MockUri } from '../test/helpers/mockVscode';

describe('Workspace File Search Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { pattern: '**/*.ts' };
            const result = workspaceFileSearchSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with optional parameters', () => {
            const validParams = {
                pattern: '**/*.ts',
                maxResults: 100,
                exclude: '**/node_modules/**',
            };
            const result = workspaceFileSearchSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing pattern', () => {
            const invalidParams = {};
            const result = workspaceFileSearchSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('searchWorkspaceFiles', () => {
        it('should return matching files', async () => {
            const mockFiles = [
                MockUri.file('/test/workspace/src/app.ts'),
                MockUri.file('/test/workspace/src/utils.ts'),
                MockUri.file('/test/workspace/test/app.test.ts'),
            ];

            mockVscode.workspace.findFiles.mockResolvedValue(mockFiles);
            mockVscode.workspace.asRelativePath.mockImplementation((uri: MockUri) =>
                uri.fsPath.replace('/test/workspace/', '')
            );

            const result = await searchWorkspaceFiles({ pattern: '**/*.ts' });

            expect(result.files).toHaveLength(3);
            expect(result.files[0].relativePath).toBe('src/app.ts');
            expect(result.files[0].uri).toContain('app.ts');
        });

        it('should respect maxResults limit', async () => {
            mockVscode.workspace.findFiles.mockResolvedValue([]);

            await searchWorkspaceFiles({ pattern: '**/*.ts', maxResults: 50 });

            expect(mockVscode.workspace.findFiles).toHaveBeenCalledWith('**/*.ts', undefined, 50);
        });

        it('should pass exclude pattern', async () => {
            mockVscode.workspace.findFiles.mockResolvedValue([]);

            await searchWorkspaceFiles({ pattern: '**/*.ts', exclude: '**/node_modules/**' });

            expect(mockVscode.workspace.findFiles).toHaveBeenCalledWith(
                '**/*.ts',
                '**/node_modules/**',
                1000
            );
        });

        it('should return empty array when no workspace is open', async () => {
            mockVscode.workspace.workspaceFolders = undefined;

            const result = await searchWorkspaceFiles({ pattern: '**/*.ts' });

            expect(result.files).toEqual([]);
        });

        it('should return empty array when workspaceFolders is empty', async () => {
            mockVscode.workspace.workspaceFolders = [];

            const result = await searchWorkspaceFiles({ pattern: '**/*.ts' });

            expect(result.files).toEqual([]);
        });
    });
});
