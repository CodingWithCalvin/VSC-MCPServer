import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getSemanticTokens, semanticTokensSchema } from './semanticTokens';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockSemanticTokens,
    MockSemanticTokensLegend,
} from '../test/helpers/mockVscode';

describe('Semantic Tokens Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = semanticTokensSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = semanticTokensSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getSemanticTokens', () => {
        it('should return decoded semantic tokens', async () => {
            // Token data format: [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
            // First token: line 0, char 0, length 5, type 0 (class), modifier 1 (declaration)
            // Second token: line 0, char 6, length 8, type 1 (function), modifier 0
            const mockTokens = new MockSemanticTokens([0, 0, 5, 0, 1, 0, 6, 8, 1, 0]);
            const mockLegend = new MockSemanticTokensLegend(
                ['class', 'function', 'variable'],
                ['declaration', 'static', 'async']
            );

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce(mockTokens)
                .mockResolvedValueOnce(mockLegend);

            const result = await getSemanticTokens({ uri: '/test/file.ts' });

            expect(result.tokens).toHaveLength(2);
            expect(result.tokens[0].line).toBe(0);
            expect(result.tokens[0].startChar).toBe(0);
            expect(result.tokens[0].length).toBe(5);
            expect(result.tokens[0].tokenType).toBe('class');
            expect(result.tokens[0].tokenModifiers).toContain('declaration');
            expect(result.tokens[1].tokenType).toBe('function');
        });

        it('should handle multi-line tokens', async () => {
            // First token: line 0, char 5
            // Second token: line 2 (delta 2), char 10 (new line, so absolute)
            const mockTokens = new MockSemanticTokens([0, 5, 3, 0, 0, 2, 10, 4, 1, 0]);
            const mockLegend = new MockSemanticTokensLegend(['class', 'function'], []);

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce(mockTokens)
                .mockResolvedValueOnce(mockLegend);

            const result = await getSemanticTokens({ uri: '/test/file.ts' });

            expect(result.tokens[0].line).toBe(0);
            expect(result.tokens[0].startChar).toBe(5);
            expect(result.tokens[1].line).toBe(2);
            expect(result.tokens[1].startChar).toBe(10);
        });

        it('should handle multiple modifiers', async () => {
            // Token with modifiers bitmap 5 (binary 101) = modifiers 0 and 2
            const mockTokens = new MockSemanticTokens([0, 0, 5, 0, 5]);
            const mockLegend = new MockSemanticTokensLegend(
                ['function'],
                ['declaration', 'static', 'async']
            );

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce(mockTokens)
                .mockResolvedValueOnce(mockLegend);

            const result = await getSemanticTokens({ uri: '/test/file.ts' });

            expect(result.tokens[0].tokenModifiers).toContain('declaration');
            expect(result.tokens[0].tokenModifiers).toContain('async');
            expect(result.tokens[0].tokenModifiers).not.toContain('static');
        });

        it('should return empty array when no semantic tokens available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getSemanticTokens({ uri: '/test/file.ts' });

            expect(result.tokens).toEqual([]);
        });

        it('should return empty array when no legend available', async () => {
            const mockTokens = new MockSemanticTokens([0, 0, 5, 0, 0]);

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce(mockTokens)
                .mockResolvedValueOnce(null);

            const result = await getSemanticTokens({ uri: '/test/file.ts' });

            expect(result.tokens).toEqual([]);
        });
    });
});
