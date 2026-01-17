import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { textEditor, textEditorSchema } from './textEditor';
import { mockVscode, resetMocks, MockTextDocument, MockUri } from '../test/helpers/mockVscode';

describe('text_editor', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('views file content', async () => {
        mockVscode.workspace.openTextDocument.mockResolvedValue(
            new MockTextDocument(MockUri.file('/test/a.txt'), 'text', 1, 'hello')
        );

        const result = await textEditor(
            textEditorSchema.parse({ action: 'view', uri: '/test/a.txt' })
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe('hello');
    });

    it('creates a file', async () => {
        const result = await textEditor(
            textEditorSchema.parse({
                action: 'create',
                uri: '/test/new.txt',
                content: 'data',
            })
        );

        expect(result.success).toBe(true);
        expect(mockVscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('previews file creation in dry-run mode', async () => {
        const result = await textEditor(
            textEditorSchema.parse({
                action: 'create',
                uri: '/test/new.txt',
                content: 'data',
                dryRun: true,
            })
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Dry-run');
        expect(mockVscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('replaces text via workspace edit', async () => {
        mockVscode.workspace.openTextDocument.mockResolvedValue(
            new MockTextDocument(MockUri.file('/test/a.txt'), 'text', 1, 'hello')
        );
        mockVscode.workspace.applyEdit.mockResolvedValue(true);

        const result = await textEditor(
            textEditorSchema.parse({
                action: 'replace',
                uri: '/test/a.txt',
                startLine: 0,
                startCharacter: 0,
                endLine: 0,
                endCharacter: 5,
                text: 'bye',
            })
        );

        expect(result.success).toBe(true);
        expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('previews replace in dry-run mode without applying', async () => {
        mockVscode.workspace.openTextDocument.mockResolvedValue(
            new MockTextDocument(MockUri.file('/test/a.txt'), 'text', 1, 'hello')
        );

        const result = await textEditor(
            textEditorSchema.parse({
                action: 'replace',
                uri: '/test/a.txt',
                startLine: 0,
                startCharacter: 0,
                endLine: 0,
                endCharacter: 5,
                text: 'bye',
                dryRun: true,
            })
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Dry-run');
        expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
    });

    it('runs undo', async () => {
        mockVscode.commands.executeCommand.mockResolvedValue(undefined);

        const result = await textEditor(textEditorSchema.parse({ action: 'undo' }));

        expect(result.success).toBe(true);
        expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('undo');
    });

    it('previews undo in dry-run mode without executing', async () => {
        const result = await textEditor(textEditorSchema.parse({ action: 'undo', dryRun: true }));

        expect(result.success).toBe(true);
        expect(result.message).toContain('Dry-run');
        expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
    });
});

