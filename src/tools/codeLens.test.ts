import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getCodeLens, codeLensSchema } from './codeLens';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockCodeLens } from '../test/helpers/mockVscode';

describe('Code Lens Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = codeLensSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = codeLensSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getCodeLens', () => {
        it('should return code lenses with commands', async () => {
            const mockLenses = [
                new MockCodeLens(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    { title: '5 references', command: 'editor.showReferences', tooltip: 'Show references' }
                ),
                new MockCodeLens(
                    new MockRange(new MockPosition(20, 0), new MockPosition(20, 15)),
                    { title: 'Run test', command: 'test.run' }
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockLenses);

            const result = await getCodeLens({ uri: '/test/file.ts' });

            expect(result.lenses).toHaveLength(2);
            expect(result.lenses[0].command?.title).toBe('5 references');
            expect(result.lenses[0].command?.command).toBe('editor.showReferences');
            expect(result.lenses[0].command?.tooltip).toBe('Show references');
            expect(result.lenses[1].command?.title).toBe('Run test');
        });

        it('should handle code lenses without commands', async () => {
            const mockLenses = [
                new MockCodeLens(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    undefined
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockLenses);

            const result = await getCodeLens({ uri: '/test/file.ts' });

            expect(result.lenses).toHaveLength(1);
            expect(result.lenses[0].command).toBeUndefined();
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getCodeLens({ uri: 'file:///test/file.ts' });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeCodeLensProvider',
                expect.any(MockUri)
            );
        });

        it('should return empty array when no code lenses available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getCodeLens({ uri: '/test/file.ts' });

            expect(result.lenses).toEqual([]);
        });
    });
});
