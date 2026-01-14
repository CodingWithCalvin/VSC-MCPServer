import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { openFolder, getOpenFolders, openFolderSchema, getOpenFoldersSchema } from './workspace';
import { mockVscode, resetMocks, MockUri } from '../test/helpers/mockVscode';

describe('Workspace Tools', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('openFolder', () => {
        describe('Schema Validation', () => {
            it('should validate correct parameters', () => {
                const validParams = { folderPath: '/test/folder' };
                const result = openFolderSchema.safeParse(validParams);
                expect(result.success).toBe(true);
            });

            it('should validate with newWindow option', () => {
                const validParams = { folderPath: '/test/folder', newWindow: true };
                const result = openFolderSchema.safeParse(validParams);
                expect(result.success).toBe(true);
            });

            it('should reject missing folderPath', () => {
                const invalidParams = {};
                const result = openFolderSchema.safeParse(invalidParams);
                expect(result.success).toBe(false);
            });
        });

        describe('openFolder function', () => {
            it('should open a folder successfully', async () => {
                mockVscode.commands.executeCommand.mockResolvedValue(undefined);

                const result = await openFolder(openFolderSchema.parse({ folderPath: '/test/folder' }));

                expect(result.success).toBe(true);
                expect(result.message).toContain('Opened folder');
                expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                    'vscode.openFolder',
                    expect.any(MockUri),
                    { forceNewWindow: false }
                );
            });

            it('should open folder in new window when specified', async () => {
                mockVscode.commands.executeCommand.mockResolvedValue(undefined);

                const result = await openFolder(openFolderSchema.parse({ folderPath: '/test/folder', newWindow: true }));

                expect(result.success).toBe(true);
                expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                    'vscode.openFolder',
                    expect.any(MockUri),
                    { forceNewWindow: true }
                );
            });

            it('should handle errors when opening folder', async () => {
                mockVscode.commands.executeCommand.mockRejectedValue(new Error('Failed to open'));

                const result = await openFolder(openFolderSchema.parse({ folderPath: '/test/folder' }));

                expect(result.success).toBe(false);
                expect(result.message).toContain('Failed to open folder');
            });
        });
    });

    describe('getOpenFolders', () => {
        describe('Schema Validation', () => {
            it('should validate empty object', () => {
                const result = getOpenFoldersSchema.safeParse({});
                expect(result.success).toBe(true);
            });
        });

        describe('getOpenFolders function', () => {
            it('should return open workspace folders', async () => {
                mockVscode.workspace.workspaceFolders = [
                    { uri: MockUri.file('/test/workspace'), name: 'test-workspace', index: 0 },
                    { uri: MockUri.file('/test/workspace2'), name: 'test-workspace2', index: 1 },
                ];

                const result = await getOpenFolders();

                expect(result.folders).toHaveLength(2);
                expect(result.folders[0].name).toBe('test-workspace');
                expect(result.folders[1].name).toBe('test-workspace2');
            });

            it('should return empty array when no workspace is open', async () => {
                mockVscode.workspace.workspaceFolders = undefined;

                const result = await getOpenFolders();

                expect(result.folders).toEqual([]);
            });

            it('should include workspace file if present', async () => {
                mockVscode.workspace.workspaceFolders = [
                    { uri: MockUri.file('/test/workspace'), name: 'test-workspace', index: 0 },
                ];
                (mockVscode.workspace as any).workspaceFile = MockUri.file('/test/test.code-workspace');

                const result = await getOpenFolders();

                expect(result.workspaceFile).toBeTruthy();
            });
        });
    });
});
