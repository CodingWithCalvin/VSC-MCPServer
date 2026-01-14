import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { applyCodeAction, applyCodeActionSchema } from './applyCodeAction';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockTextEdit,
    MockWorkspaceEdit,
    MockCodeAction,
} from '../test/helpers/mockVscode';

describe('Apply Code Action Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Add missing import',
            };
            const result = applyCodeActionSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with dryRun and kind options', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Extract function',
                kind: 'refactor',
                dryRun: true,
            };
            const result = applyCodeActionSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing actionTitle', () => {
            const invalidParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
            };
            const result = applyCodeActionSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('applyCodeAction', () => {
        it('should apply code action with edits', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');
            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(0, 0)),
                    "import { something } from 'somewhere';\n"
                ),
            ]);

            const mockAction = new MockCodeAction('Add missing import', { value: 'quickfix' }, mockEdit);

            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Add missing import',
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully applied');
            expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
        });

        it('should preview changes in dry-run mode without applying', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');
            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(0, 0)),
                    "import { something } from 'somewhere';\n"
                ),
            ]);

            const mockAction = new MockCodeAction('Add missing import', { value: 'quickfix' }, mockEdit);

            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Add missing import',
                dryRun: true,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry-run');
            expect(result.changes).toBeDefined();
            expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('should handle command-based actions', async () => {
            const mockCommand = { title: 'Run command', command: 'myCommand', arguments: ['arg1'] };

            mockVscode.commands.executeCommand.mockResolvedValue([mockCommand]);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Run command',
                dryRun: false,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Executed command');
        });

        it('should reject dry-run for command-based actions', async () => {
            const mockCommand = { title: 'Run command', command: 'myCommand', arguments: [] };

            mockVscode.commands.executeCommand.mockResolvedValue([mockCommand]);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Run command',
                dryRun: true,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Cannot preview');
        });

        it('should handle action not found', async () => {
            const mockAction = new MockCodeAction('Different action', { value: 'quickfix' });

            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Non-existent action',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
            expect(result.message).toContain('Available actions');
        });

        it('should handle no code actions available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Any action',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('No code actions available');
        });

        it('should handle apply edit failure', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');
            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(0, 0)),
                    'new code'
                ),
            ]);

            const mockAction = new MockCodeAction('Fix issue', { value: 'quickfix' }, mockEdit);

            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);
            mockVscode.workspace.applyEdit.mockResolvedValue(false);

            const result = await applyCodeAction({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                actionTitle: 'Fix issue',
                dryRun: false,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to apply');
        });
    });
});
