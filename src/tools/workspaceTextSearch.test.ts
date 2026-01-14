import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { searchWorkspaceText, workspaceTextSearchSchema } from './workspaceTextSearch';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition } from '../test/helpers/mockVscode';

describe('Workspace Text Search Tool', () => {
    beforeEach(() => {
        resetMocks();
        mockVscode.workspace.workspaceFolders = [
            { uri: MockUri.file('/test/workspace'), name: 'test-workspace' },
        ];
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                query: 'searchTerm',
            };

            const result = workspaceTextSearchSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with all optional parameters', () => {
            const validParams = {
                query: 'searchTerm',
                isRegex: true,
                isCaseSensitive: true,
                includePattern: '**/*.ts',
                excludePattern: '**/node_modules/**',
                maxResults: 100,
            };

            const result = workspaceTextSearchSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing query', () => {
            const invalidParams = {};

            const result = workspaceTextSearchSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('searchWorkspaceText', () => {
        it('should find text across multiple files', async () => {
            const mockResults = [
                {
                    uri: MockUri.file('/test/workspace/file1.ts'),
                    ranges: [new MockRange(new MockPosition(5, 0), new MockPosition(5, 10))],
                    preview: { text: 'function searchTerm() {', matches: [] },
                },
                {
                    uri: MockUri.file('/test/workspace/file2.ts'),
                    ranges: [
                        new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                        new MockRange(new MockPosition(20, 8), new MockPosition(20, 18)),
                    ],
                    preview: { text: 'const searchTerm = 42;', matches: [] },
                },
            ];

            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                for (const result of mockResults) {
                    callback(result);
                }
            });

            const result = await searchWorkspaceText({
                query: 'searchTerm',
            });

            expect(result.results).toHaveLength(2);
            expect(result.results[0].matches).toHaveLength(1);
            expect(result.results[1].matches).toHaveLength(2);
        });

        it('should handle regex search', async () => {
            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                // No results for simplicity
            });

            await searchWorkspaceText({
                query: 'function.*\\(\\)',
                isRegex: true,
            });

            expect(mockVscode.workspace.findTextInFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    pattern: expect.any(RegExp),
                    isRegExp: true,
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should handle case-sensitive search', async () => {
            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                // No results
            });

            await searchWorkspaceText({
                query: 'SearchTerm',
                isCaseSensitive: true,
            });

            expect(mockVscode.workspace.findTextInFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    isCaseSensitive: true,
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should respect include pattern', async () => {
            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                // No results
            });

            await searchWorkspaceText({
                query: 'test',
                includePattern: '**/*.test.ts',
            });

            expect(mockVscode.workspace.findTextInFiles).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    include: '**/*.test.ts',
                }),
                expect.any(Function)
            );
        });

        it('should respect exclude pattern', async () => {
            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                // No results
            });

            await searchWorkspaceText({
                query: 'test',
                excludePattern: '**/node_modules/**',
            });

            expect(mockVscode.workspace.findTextInFiles).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    exclude: '**/node_modules/**',
                }),
                expect.any(Function)
            );
        });

        it('should respect maxResults limit', async () => {
            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                // No results
            });

            await searchWorkspaceText({
                query: 'test',
                maxResults: 50,
            });

            expect(mockVscode.workspace.findTextInFiles).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    maxResults: 50,
                }),
                expect.any(Function)
            );
        });

        it('should return empty results when no workspace open', async () => {
            mockVscode.workspace.workspaceFolders = undefined;

            const result = await searchWorkspaceText({
                query: 'test',
            });

            expect(result.results).toEqual([]);
        });

        it('should group matches by file', async () => {
            const mockResults = [
                {
                    uri: MockUri.file('/test/workspace/file1.ts'),
                    ranges: [new MockRange(new MockPosition(1, 0), new MockPosition(1, 4))],
                    preview: { text: 'test line 1', matches: [] },
                },
                {
                    uri: MockUri.file('/test/workspace/file1.ts'),
                    ranges: [new MockRange(new MockPosition(5, 0), new MockPosition(5, 4))],
                    preview: { text: 'test line 2', matches: [] },
                },
            ];

            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                for (const result of mockResults) {
                    callback(result);
                }
            });

            const result = await searchWorkspaceText({
                query: 'test',
            });

            expect(result.results).toHaveLength(1);
            expect(result.results[0].matches).toHaveLength(2);
        });

        it('should include preview text for each match', async () => {
            const mockResults = [
                {
                    uri: MockUri.file('/test/workspace/file1.ts'),
                    ranges: [new MockRange(new MockPosition(10, 0), new MockPosition(10, 10))],
                    preview: { text: 'function example() {', matches: [] },
                },
            ];

            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                for (const result of mockResults) {
                    callback(result);
                }
            });

            const result = await searchWorkspaceText({
                query: 'example',
            });

            expect(result.results[0].matches[0].preview).toBe('function example() {');
            expect(result.results[0].matches[0].lineNumber).toBe(10);
        });

        it('should provide relative paths', async () => {
            const mockResults = [
                {
                    uri: MockUri.file('/test/workspace/src/utils/helper.ts'),
                    ranges: [new MockRange(new MockPosition(0, 0), new MockPosition(0, 5))],
                    preview: { text: 'match', matches: [] },
                },
            ];

            mockVscode.workspace.findTextInFiles.mockImplementation(async (query, options, callback) => {
                for (const result of mockResults) {
                    callback(result);
                }
            });

            mockVscode.workspace.asRelativePath.mockReturnValue('src/utils/helper.ts');

            const result = await searchWorkspaceText({
                query: 'match',
            });

            expect(result.results[0].relativePath).toBe('src/utils/helper.ts');
        });
    });
});
