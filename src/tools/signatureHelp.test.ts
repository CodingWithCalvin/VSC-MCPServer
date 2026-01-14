import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getSignatureHelp, signatureHelpSchema } from './signatureHelp';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockPosition,
    MockMarkdownString,
    MockSignatureHelp,
} from '../test/helpers/mockVscode';

describe('Signature Help Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = signatureHelpSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = signatureHelpSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getSignatureHelp', () => {
        it('should return signature help', async () => {
            const mockSignatureHelp = new MockSignatureHelp(
                [
                    {
                        label: 'function myFunc(a: number, b: string): void',
                        documentation: 'My function description',
                        parameters: [
                            { label: 'a: number', documentation: 'First parameter' },
                            { label: 'b: string', documentation: 'Second parameter' },
                        ],
                    },
                ],
                0,
                1
            );

            mockVscode.commands.executeCommand.mockResolvedValue(mockSignatureHelp);

            const result = await getSignatureHelp({ uri: '/test/file.ts', line: 10, character: 20 });

            expect(result.signatures).toHaveLength(1);
            expect(result.signatures[0].label).toBe('function myFunc(a: number, b: string): void');
            expect(result.signatures[0].parameters).toHaveLength(2);
            expect(result.activeSignature).toBe(0);
            expect(result.activeParameter).toBe(1);
        });

        it('should handle MarkdownString documentation', async () => {
            const mockSignatureHelp = new MockSignatureHelp(
                [
                    {
                        label: 'function myFunc(): void',
                        documentation: new MockMarkdownString('**Bold** documentation'),
                        parameters: [],
                    },
                ],
                0,
                0
            );

            mockVscode.commands.executeCommand.mockResolvedValue(mockSignatureHelp);

            const result = await getSignatureHelp({ uri: '/test/file.ts', line: 10, character: 20 });

            expect(result.signatures[0].documentation).toBe('**Bold** documentation');
        });

        it('should handle parameter label as tuple', async () => {
            const mockSignatureHelp = new MockSignatureHelp(
                [
                    {
                        label: 'function myFunc(param: number): void',
                        parameters: [{ label: [16, 29] as [number, number] }],
                    },
                ],
                0,
                0
            );

            mockVscode.commands.executeCommand.mockResolvedValue(mockSignatureHelp);

            const result = await getSignatureHelp({ uri: '/test/file.ts', line: 10, character: 20 });

            expect(result.signatures[0].parameters?.[0].label).toBe('param[16-29]');
        });

        it('should return empty signatures when no help available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getSignatureHelp({ uri: '/test/file.ts', line: 10, character: 20 });

            expect(result.signatures).toEqual([]);
        });
    });
});
