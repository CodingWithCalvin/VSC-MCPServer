import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { formatDocument, formatDocumentSchema } from './formatDocument';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition } from '../test/helpers/mockVscode';

describe('Format Document Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
            };

            const result = formatDocumentSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with dryRun parameter', () => {
            const validParams = {
                uri: '/test/file.ts',
                dryRun: true,
            };

            const result = formatDocumentSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};

            const result = formatDocumentSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('formatDocument', () => {
        it('should format document and apply changes', async () => {
            const mockEdits = [
                {
                    range: new MockRange(new MockPosition(0, 0), new MockPosition(0, 10)),
                    newText: 'formatted code',
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await formatDocument({
                uri: '/test/file.ts',
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.edits).toHaveLength(1);
            expect(result.message).toContain('Successfully formatted');
            expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
        });

        it('should preview changes in dry-run mode without applying', async () => {
            const mockEdits = [
                {
                    range: new MockRange(new MockPosition(0, 0), new MockPosition(0, 10)),
                    newText: 'formatted code',
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);

            const result = await formatDocument({
                uri: '/test/file.ts',
                dryRun: true,
            });

            expect(result.success).toBe(true);
            expect(result.edits).toHaveLength(1);
            expect(result.message).toContain('Dry-run');
            expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('should handle no formatting changes needed', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await formatDocument({
                uri: '/test/file.ts',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No formatting changes');
        });

        it('should handle empty edits array', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            const result = await formatDocument({
                uri: '/test/file.ts',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No formatting changes');
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await formatDocument({
                uri: 'file:///test/file.ts',
            });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeFormatDocumentProvider',
                expect.any(MockUri),
                expect.objectContaining({
                    tabSize: 4,
                    insertSpaces: true,
                })
            );
        });

        it('should handle apply edit failure', async () => {
            const mockEdits = [
                {
                    range: new MockRange(new MockPosition(0, 0), new MockPosition(0, 10)),
                    newText: 'formatted code',
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);
            mockVscode.workspace.applyEdit.mockResolvedValue(false);

            const result = await formatDocument({
                uri: '/test/file.ts',
                dryRun: false,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to apply');
        });

        it('should return edit details for preview', async () => {
            const mockEdits = [
                {
                    range: new MockRange(new MockPosition(5, 0), new MockPosition(5, 20)),
                    newText: '    formatted line',
                },
                {
                    range: new MockRange(new MockPosition(10, 0), new MockPosition(10, 15)),
                    newText: '        indented',
                },
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);

            const result = await formatDocument({
                uri: '/test/file.ts',
                dryRun: true,
            });

            expect(result.edits).toHaveLength(2);
            expect(result.edits![0].range.startLine).toBe(5);
            expect(result.edits![0].newText).toBe('    formatted line');
            expect(result.edits![1].range.startLine).toBe(10);
        });
    });
});
