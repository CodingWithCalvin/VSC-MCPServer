import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { renameSymbol, renameSymbolSchema } from './renameSymbol';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockWorkspaceEdit,
    MockTextEdit,
    MockRange,
    MockPosition,
} from '../test/helpers/mockVscode';

describe('Rename Symbol Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
                line: 10,
                character: 5,
                newName: 'newFunctionName',
            };

            const result = renameSymbolSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with dryRun parameter', () => {
            const validParams = {
                uri: '/test/file.ts',
                line: 10,
                character: 5,
                newName: 'newFunctionName',
                dryRun: true,
            };

            const result = renameSymbolSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing newName', () => {
            const invalidParams = {
                uri: '/test/file.ts',
                line: 10,
                character: 5,
            };

            const result = renameSymbolSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('renameSymbol', () => {
        it('should rename symbol across single file', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const file1Uri = MockUri.file('/test/file.ts');

            mockEdit.set(file1Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(5, 10), new MockPosition(5, 20)),
                    'newName'
                ),
                new MockTextEdit(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                    'newName'
                ),
            ]);

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await renameSymbol({
                uri: '/test/file.ts',
                line: 5,
                character: 10,
                newName: 'newName',
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.changes![0].edits).toHaveLength(2);
            expect(result.message).toContain('Successfully renamed');
            expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
        });

        it('should rename symbol across multiple files', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const file1Uri = MockUri.file('/test/file1.ts');
            const file2Uri = MockUri.file('/test/file2.ts');
            const file3Uri = MockUri.file('/test/file3.ts');

            mockEdit.set(file1Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(5, 10), new MockPosition(5, 20)),
                    'newName'
                ),
            ]);

            mockEdit.set(file2Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(15, 0), new MockPosition(15, 10)),
                    'newName'
                ),
                new MockTextEdit(
                    new MockRange(new MockPosition(20, 5), new MockPosition(20, 15)),
                    'newName'
                ),
            ]);

            mockEdit.set(file3Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(3, 8), new MockPosition(3, 18)),
                    'newName'
                ),
            ]);

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await renameSymbol({
                uri: '/test/file1.ts',
                line: 5,
                character: 10,
                newName: 'newName',
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.changes).toHaveLength(3);
            expect(result.message).toContain('3 file(s)');
            expect(result.message).toContain('4 change(s)');
        });

        it('should preview rename in dry-run mode without applying', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');

            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(0, 10)),
                    'newName'
                ),
            ]);

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);

            const result = await renameSymbol({
                uri: '/test/file.ts',
                line: 0,
                character: 0,
                newName: 'newName',
                dryRun: true,
            });

            expect(result.success).toBe(true);
            expect(result.changes).toHaveLength(1);
            expect(result.message).toContain('Dry-run');
            expect(result.message).toContain('Would rename');
            expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('should handle rename not available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await renameSymbol({
                uri: '/test/file.ts',
                line: 0,
                character: 0,
                newName: 'newName',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not available');
        });

        it('should handle empty workspace edit', async () => {
            const mockEdit = new MockWorkspaceEdit();
            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);

            const result = await renameSymbol({
                uri: '/test/file.ts',
                line: 0,
                character: 0,
                newName: 'newName',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No rename changes');
        });

        it('should handle apply edit failure', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');

            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(0, 10)),
                    'newName'
                ),
            ]);

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);
            mockVscode.workspace.applyEdit.mockResolvedValue(false);

            const result = await renameSymbol({
                uri: '/test/file.ts',
                line: 0,
                character: 0,
                newName: 'newName',
                dryRun: false,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to apply');
        });

        it('should provide detailed change information for each file', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const file1Uri = MockUri.file('/test/file1.ts');
            const file2Uri = MockUri.file('/test/file2.ts');

            mockEdit.set(file1Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(5, 0), new MockPosition(5, 10)),
                    'renamedSymbol'
                ),
            ]);

            mockEdit.set(file2Uri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                    'renamedSymbol'
                ),
            ]);

            mockVscode.commands.executeCommand.mockResolvedValue(mockEdit);

            const result = await renameSymbol({
                uri: '/test/file1.ts',
                line: 5,
                character: 0,
                newName: 'renamedSymbol',
                dryRun: true,
            });

            expect(result.changes).toHaveLength(2);
            expect(result.changes![0].uri).toBeTruthy();
            expect(result.changes![0].edits[0].newText).toBe('renamedSymbol');
            expect(result.changes![1].uri).toBeTruthy();
            expect(result.changes![1].edits[0].newText).toBe('renamedSymbol');
        });
    });
});
