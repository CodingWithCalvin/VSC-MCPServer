import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getCompletions, completionsSchema } from './completions';
import { mockVscode, resetMocks, MockUri, MockPosition } from '../test/helpers/mockVscode';

describe('Completions Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            };

            const result = completionsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with optional triggerCharacter', () => {
            const validParams = {
                uri: '/test/file.ts',
                line: 10,
                character: 5,
                triggerCharacter: '.',
            };

            const result = completionsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = {
                uri: '/test/file.ts',
                // missing line and character
            };

            const result = completionsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });

        it('should reject invalid types', () => {
            const invalidParams = {
                uri: '/test/file.ts',
                line: 'not-a-number',
                character: 5,
            };

            const result = completionsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getCompletions', () => {
        it('should return completions from LSP', async () => {
            const mockCompletions = {
                items: [
                    {
                        label: 'getValue',
                        kind: mockVscode.CompletionItemKind.Method,
                        detail: '(): number',
                        documentation: 'Gets the value',
                    },
                    {
                        label: 'setValue',
                        kind: mockVscode.CompletionItemKind.Method,
                        detail: '(value: number): void',
                        documentation: 'Sets the value',
                    },
                ],
            };

            mockVscode.commands.executeCommand.mockResolvedValue(mockCompletions);

            const result = await getCompletions({
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            });

            expect(result.items).toHaveLength(2);
            expect(result.items[0].label).toBe('getValue');
            expect(result.items[0].kind).toBe('Method');
            expect(result.items[1].label).toBe('setValue');
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue({ items: [] });

            await getCompletions({
                uri: 'file:///test/file.ts',
                line: 0,
                character: 0,
            });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeCompletionItemProvider',
                expect.any(MockUri),
                expect.any(MockPosition),
                undefined
            );
        });

        it('should handle trigger characters', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue({ items: [] });

            await getCompletions({
                uri: '/test/file.ts',
                line: 10,
                character: 5,
                triggerCharacter: '.',
            });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeCompletionItemProvider',
                expect.any(MockUri),
                expect.any(MockPosition),
                '.'
            );
        });

        it('should return empty array when no completions available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getCompletions({
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            });

            expect(result.items).toEqual([]);
        });

        it('should handle CompletionItemLabel objects', async () => {
            const mockCompletions = {
                items: [
                    {
                        label: { label: 'complexLabel', detail: 'detail', description: 'desc' },
                        kind: mockVscode.CompletionItemKind.Function,
                    },
                ],
            };

            mockVscode.commands.executeCommand.mockResolvedValue(mockCompletions);

            const result = await getCompletions({
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            });

            expect(result.items[0].label).toBe('complexLabel');
        });

        it('should handle MarkdownString documentation', async () => {
            const mockCompletions = {
                items: [
                    {
                        label: 'test',
                        kind: mockVscode.CompletionItemKind.Function,
                        documentation: { value: '**Bold** markdown', isTrusted: true },
                    },
                ],
            };

            mockVscode.commands.executeCommand.mockResolvedValue(mockCompletions);

            const result = await getCompletions({
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            });

            expect(result.items[0].documentation).toBe('**Bold** markdown');
        });

        it('should map all completion item kinds correctly', async () => {
            const kinds = [
                { kind: mockVscode.CompletionItemKind.Class, expected: 'Class' },
                { kind: mockVscode.CompletionItemKind.Interface, expected: 'Interface' },
                { kind: mockVscode.CompletionItemKind.Variable, expected: 'Variable' },
                { kind: mockVscode.CompletionItemKind.Property, expected: 'Property' },
                { kind: mockVscode.CompletionItemKind.Keyword, expected: 'Keyword' },
            ];

            for (const { kind, expected } of kinds) {
                const mockCompletions = {
                    items: [{ label: 'test', kind }],
                };

                mockVscode.commands.executeCommand.mockResolvedValue(mockCompletions);

                const result = await getCompletions({
                    uri: '/test/file.ts',
                    line: 0,
                    character: 0,
                });

                expect(result.items[0].kind).toBe(expected);
            }
        });
    });
});
