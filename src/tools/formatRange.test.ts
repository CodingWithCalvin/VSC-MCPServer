import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { formatRange, formatRangeSchema } from './formatRange';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockTextEdit } from '../test/helpers/mockVscode';

describe('Format Range Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
            };
            const result = formatRangeSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with dryRun option', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
                dryRun: true,
            };
            const result = formatRangeSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts', startLine: 10 };
            const result = formatRangeSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('formatRange', () => {
        it('should format range and apply changes', async () => {
            const mockEdits = [
                new MockTextEdit(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    '    formatted code'
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await formatRange({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.edits).toHaveLength(1);
            expect(result.message).toContain('Successfully formatted');
            expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
        });

        it('should preview changes in dry-run mode without applying', async () => {
            const mockEdits = [
                new MockTextEdit(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    '    formatted code'
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);

            const result = await formatRange({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
                dryRun: true,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry-run');
            expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('should handle no formatting changes needed', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await formatRange({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No formatting changes');
        });

        it('should handle apply edit failure', async () => {
            const mockEdits = [
                new MockTextEdit(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    '    formatted code'
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdits);
            mockVscode.workspace.applyEdit.mockResolvedValue(false);

            const result = await formatRange({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 20,
                endCharacter: 0,
                dryRun: false,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to apply');
        });
    });
});
