import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { organizeImports, organizeImportsSchema } from './organizeImports';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockTextEdit,
    MockWorkspaceEdit,
    MockCodeAction,
    MockTextDocument,
} from '../test/helpers/mockVscode';

describe('Organize Imports Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = organizeImportsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with dryRun option', () => {
            const validParams = { uri: '/test/file.ts', dryRun: true };
            const result = organizeImportsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = organizeImportsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('organizeImports', () => {
        it('should organize imports and apply changes', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');
            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(5, 0)),
                    "import { a } from 'a';\nimport { b } from 'b';\n"
                ),
            ]);

            const mockAction = new MockCodeAction(
                'Organize Imports',
                mockVscode.CodeActionKind.SourceOrganizeImports,
                mockEdit
            );

            mockVscode.workspace.openTextDocument.mockResolvedValue(
                new MockTextDocument(fileUri, 'typescript', 1, 'import content')
            );
            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);
            mockVscode.workspace.applyEdit.mockResolvedValue(true);

            const result = await organizeImports({ uri: '/test/file.ts', dryRun: false });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully organized');
            expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
        });

        it('should preview changes in dry-run mode without applying', async () => {
            const mockEdit = new MockWorkspaceEdit();
            const fileUri = MockUri.file('/test/file.ts');
            mockEdit.set(fileUri, [
                new MockTextEdit(
                    new MockRange(new MockPosition(0, 0), new MockPosition(5, 0)),
                    'organized imports'
                ),
            ]);

            const mockAction = new MockCodeAction(
                'Organize Imports',
                mockVscode.CodeActionKind.SourceOrganizeImports,
                mockEdit
            );

            mockVscode.workspace.openTextDocument.mockResolvedValue(
                new MockTextDocument(fileUri, 'typescript', 1, 'import content')
            );
            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);

            const result = await organizeImports({ uri: '/test/file.ts', dryRun: true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry-run');
            expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('should handle organize imports not available', async () => {
            mockVscode.workspace.openTextDocument.mockResolvedValue(
                new MockTextDocument(MockUri.file('/test/file.ts'), 'typescript', 1, 'content')
            );
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await organizeImports({ uri: '/test/file.ts' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not available');
        });

        it('should handle no organize imports action found', async () => {
            const mockAction = new MockCodeAction('Other Action', { value: 'quickfix' });

            mockVscode.workspace.openTextDocument.mockResolvedValue(
                new MockTextDocument(MockUri.file('/test/file.ts'), 'typescript', 1, 'content')
            );
            mockVscode.commands.executeCommand.mockResolvedValue([mockAction]);

            const result = await organizeImports({ uri: '/test/file.ts' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });
    });
});
