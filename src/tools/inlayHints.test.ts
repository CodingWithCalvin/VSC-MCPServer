import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getInlayHints, inlayHintsSchema } from './inlayHints';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockPosition,
    MockInlayHint,
    MockMarkdownString,
} from '../test/helpers/mockVscode';

describe('Inlay Hints Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            };
            const result = inlayHintsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts', startLine: 0 };
            const result = inlayHintsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getInlayHints', () => {
        it('should return inlay hints with string labels', async () => {
            const mockHints = [
                new MockInlayHint(
                    new MockPosition(10, 20),
                    ': number',
                    mockVscode.InlayHintKind.Type,
                    'Type annotation',
                    false,
                    true
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHints);

            const result = await getInlayHints({
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            });

            expect(result.hints).toHaveLength(1);
            expect(result.hints[0].label).toBe(': number');
            expect(result.hints[0].kind).toBe('Type');
            expect(result.hints[0].tooltip).toBe('Type annotation');
            expect(result.hints[0].paddingRight).toBe(true);
        });

        it('should return inlay hints with label parts', async () => {
            const mockHints = [
                new MockInlayHint(
                    new MockPosition(10, 20),
                    [{ value: 'param' }, { value: ': ' }, { value: 'string' }],
                    mockVscode.InlayHintKind.Parameter,
                    undefined,
                    true,
                    false
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHints);

            const result = await getInlayHints({
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            });

            expect(result.hints[0].label).toBe('param: string');
            expect(result.hints[0].kind).toBe('Parameter');
        });

        it('should handle MarkdownString tooltip', async () => {
            const mockHints = [
                new MockInlayHint(
                    new MockPosition(10, 20),
                    ': number',
                    mockVscode.InlayHintKind.Type,
                    new MockMarkdownString('**Bold** tooltip')
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHints);

            const result = await getInlayHints({
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            });

            expect(result.hints[0].tooltip).toBe('**Bold** tooltip');
        });

        it('should handle unknown hint kind', async () => {
            const mockHints = [new MockInlayHint(new MockPosition(10, 20), 'hint', undefined)];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHints);

            const result = await getInlayHints({
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            });

            expect(result.hints[0].kind).toBe('Unknown');
        });

        it('should return empty array when no hints available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getInlayHints({
                uri: '/test/file.ts',
                startLine: 0,
                startCharacter: 0,
                endLine: 100,
                endCharacter: 0,
            });

            expect(result.hints).toEqual([]);
        });
    });
});
