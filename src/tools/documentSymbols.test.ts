import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getDocumentSymbols, documentSymbolsSchema } from './documentSymbols';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition } from '../test/helpers/mockVscode';

describe('Document Symbols Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = documentSymbolsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with optional query', () => {
            const validParams = { uri: '/test/file.ts', query: 'function' };
            const result = documentSymbolsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = documentSymbolsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getDocumentSymbols', () => {
        it('should return document symbols', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: mockVscode.SymbolKind.Class,
                    range: new MockRange(new MockPosition(0, 0), new MockPosition(10, 0)),
                    selectionRange: new MockRange(new MockPosition(0, 6), new MockPosition(0, 13)),
                    children: [],
                },
                {
                    name: 'myFunction',
                    kind: mockVscode.SymbolKind.Function,
                    range: new MockRange(new MockPosition(12, 0), new MockPosition(20, 0)),
                    selectionRange: new MockRange(new MockPosition(12, 9), new MockPosition(12, 19)),
                    children: [],
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockSymbols);

            const result = await getDocumentSymbols({ uri: '/test/file.ts' });

            expect(result.symbols).toHaveLength(2);
            expect(result.symbols[0].name).toBe('MyClass');
            expect(result.symbols[1].name).toBe('myFunction');
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getDocumentSymbols({ uri: 'file:///test/file.ts' });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeDocumentSymbolProvider',
                expect.any(MockUri)
            );
        });

        it('should return empty array when no symbols found', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getDocumentSymbols({ uri: '/test/file.ts' });

            expect(result.symbols).toEqual([]);
        });

        it('should filter symbols by query', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: mockVscode.SymbolKind.Class,
                    range: new MockRange(new MockPosition(0, 0), new MockPosition(10, 0)),
                    selectionRange: new MockRange(new MockPosition(0, 6), new MockPosition(0, 13)),
                    children: [],
                },
                {
                    name: 'myFunction',
                    kind: mockVscode.SymbolKind.Function,
                    range: new MockRange(new MockPosition(12, 0), new MockPosition(20, 0)),
                    selectionRange: new MockRange(new MockPosition(12, 9), new MockPosition(12, 19)),
                    children: [],
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockSymbols);

            const result = await getDocumentSymbols({ uri: '/test/file.ts', query: 'class' });

            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('MyClass');
        });
    });
});
