import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getCodeActions, codeActionsSchema } from './codeActions';
import { mockVscode, resetMocks, MockUri, MockCodeAction } from '../test/helpers/mockVscode';

describe('Code Actions Tool', () => {
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
            };
            const result = codeActionsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with kind filter', () => {
            const validParams = {
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
                kind: 'quickfix',
            };
            const result = codeActionsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts', startLine: 10 };
            const result = codeActionsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getCodeActions', () => {
        it('should return code actions', async () => {
            const mockActions = [
                new MockCodeAction(
                    'Extract function',
                    { value: 'refactor.extract' },
                    undefined,
                    undefined,
                    false,
                    undefined
                ),
                new MockCodeAction(
                    'Add missing import',
                    { value: 'quickfix' },
                    undefined,
                    [{ message: 'Cannot find name X' }],
                    true,
                    undefined
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockActions);

            const result = await getCodeActions({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
            });

            expect(result.actions).toHaveLength(2);
            expect(result.actions[0].title).toBe('Extract function');
            expect(result.actions[0].kind).toBe('refactor.extract');
            expect(result.actions[1].title).toBe('Add missing import');
            expect(result.actions[1].isPreferred).toBe(true);
            expect(result.actions[1].diagnostics).toContain('Cannot find name X');
        });

        it('should handle Command type actions', async () => {
            const mockActions = [{ title: 'Run command', command: 'myCommand', arguments: [] }];

            mockVscode.commands.executeCommand.mockResolvedValue(mockActions);

            const result = await getCodeActions({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
            });

            expect(result.actions).toHaveLength(1);
            expect(result.actions[0].title).toBe('Run command');
            expect(result.actions[0].kind).toBeUndefined();
        });

        it('should handle disabled actions', async () => {
            const mockActions = [
                new MockCodeAction(
                    'Disabled action',
                    { value: 'quickfix' },
                    undefined,
                    undefined,
                    false,
                    { reason: 'Not applicable here' }
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockActions);

            const result = await getCodeActions({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
            });

            expect(result.actions[0].disabled).toBe('Not applicable here');
        });

        it('should return empty array when no actions available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getCodeActions({
                uri: '/test/file.ts',
                startLine: 10,
                startCharacter: 0,
                endLine: 10,
                endCharacter: 20,
            });

            expect(result.actions).toEqual([]);
        });
    });
});
