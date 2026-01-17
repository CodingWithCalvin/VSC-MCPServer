import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { previewUrl, previewUrlSchema } from './previewUrl';
import { mockVscode, resetMocks } from '../test/helpers/mockVscode';

describe('preview_url', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('opens via Simple Browser when available', async () => {
        mockVscode.commands.executeCommand.mockResolvedValue(undefined);

        const result = await previewUrl(previewUrlSchema.parse({ url: 'https://example.com' }));

        expect(result.success).toBe(true);
        expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
            'simpleBrowser.show',
            'https://example.com'
        );
        expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('falls back to external browser when Simple Browser fails', async () => {
        mockVscode.commands.executeCommand.mockRejectedValue(new Error('no simpleBrowser'));

        const result = await previewUrl(previewUrlSchema.parse({ url: 'https://example.com' }));

        expect(result.success).toBe(true);
        expect(mockVscode.env.openExternal).toHaveBeenCalled();
    });
});

