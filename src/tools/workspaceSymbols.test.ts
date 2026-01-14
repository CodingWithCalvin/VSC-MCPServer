import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getWorkspaceSymbols, workspaceSymbolsSchema } from './workspaceSymbols';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition } from '../test/helpers/mockVscode';

describe('Workspace Symbols Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { query: 'MyClass' };
            const result = workspaceSymbolsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with maxResults', () => {
            const validParams = { query: 'MyClass', maxResults: 100 };
            const result = workspaceSymbolsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing query', () => {
            const invalidParams = {};
            const result = workspaceSymbolsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getWorkspaceSymbols', () => {
        it('should return workspace symbols', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: mockVscode.SymbolKind.Class,
                    location: {
                        uri: MockUri.file('/test/file1.ts'),
                        range: new MockRange(new MockPosition(0, 0), new MockPosition(10, 0)),
                    },
                    containerName: 'module',
                },
                {
                    name: 'MyOtherClass',
                    kind: mockVscode.SymbolKind.Class,
                    location: {
                        uri: MockUri.file('/test/file2.ts'),
                        range: new MockRange(new MockPosition(5, 0), new MockPosition(15, 0)),
                    },
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockSymbols);

            const result = await getWorkspaceSymbols({ query: 'Class' });

            expect(result.symbols).toHaveLength(2);
            expect(result.totalCount).toBe(2);
            expect(result.symbols[0].name).toBe('MyClass');
            expect(result.symbols[0].containerName).toBe('module');
        });

        it('should respect maxResults limit', async () => {
            const mockSymbols = Array.from({ length: 100 }, (_, i) => ({
                name: `Symbol${i}`,
                kind: mockVscode.SymbolKind.Function,
                location: {
                    uri: MockUri.file('/test/file.ts'),
                    range: new MockRange(new MockPosition(i, 0), new MockPosition(i + 1, 0)),
                },
            }));

            mockVscode.commands.executeCommand.mockResolvedValue(mockSymbols);

            const result = await getWorkspaceSymbols({ query: 'Symbol', maxResults: 10 });

            expect(result.symbols).toHaveLength(10);
            expect(result.totalCount).toBe(100);
        });

        it('should return empty array when no symbols found', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getWorkspaceSymbols({ query: 'NonExistent' });

            expect(result.symbols).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });
});
