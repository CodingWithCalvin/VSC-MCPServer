import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { focusEditor, focusEditorSchema } from './focusEditor';
import { mockVscode, resetMocks, MockUri } from '../test/helpers/mockVscode';

describe('focus_editor', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('opens a document and sets selection', async () => {
        const revealRange = vi.fn();
        const editor: any = { selection: undefined, revealRange };
        mockVscode.window.showTextDocument.mockResolvedValue(editor);

        const result = await focusEditor(
            focusEditorSchema.parse({
                uri: '/test/file.ts',
                startLine: 1,
                startCharacter: 2,
                endLine: 3,
                endCharacter: 4,
            })
        );

        expect(result.success).toBe(true);
        expect(mockVscode.window.showTextDocument).toHaveBeenCalledWith(expect.any(MockUri), {
            preserveFocus: false,
            preview: false,
        });
        expect(editor.selection).toBeTruthy();
        expect(revealRange).toHaveBeenCalled();
    });
});

