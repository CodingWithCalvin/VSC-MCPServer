import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getHoverInfo, hoverInfoSchema } from './hoverInfo';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockMarkdownString,
    MockHover,
} from '../test/helpers/mockVscode';

describe('Hover Info Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = hoverInfoSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = hoverInfoSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getHoverInfo', () => {
        it('should return hover info with string content', async () => {
            const mockHovers = [
                new MockHover(
                    ['function myFunction(): void'],
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHovers);

            const result = await getHoverInfo({ uri: '/test/file.ts', line: 10, character: 5 });

            expect(result.contents).toHaveLength(1);
            expect(result.contents[0].value).toBe('function myFunction(): void');
        });

        it('should return hover info with MarkdownString content', async () => {
            const mockHovers = [
                new MockHover(
                    [new MockMarkdownString('**Documentation** for function')],
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHovers);

            const result = await getHoverInfo({ uri: '/test/file.ts', line: 10, character: 5 });

            expect(result.contents).toHaveLength(1);
            expect(result.contents[0].value).toBe('**Documentation** for function');
            expect(result.contents[0].language).toBe('markdown');
        });

        it('should return hover info with language-value object', async () => {
            const mockHovers = [
                new MockHover(
                    [{ value: 'const x: number', language: 'typescript' }],
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHovers);

            const result = await getHoverInfo({ uri: '/test/file.ts', line: 10, character: 5 });

            expect(result.contents).toHaveLength(1);
            expect(result.contents[0].value).toBe('const x: number');
            expect(result.contents[0].language).toBe('typescript');
        });

        it('should include range in response', async () => {
            const mockHovers = [
                new MockHover(
                    ['test'],
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHovers);

            const result = await getHoverInfo({ uri: '/test/file.ts', line: 10, character: 5 });

            expect(result.range).toBeTruthy();
            expect(result.range?.startLine).toBe(10);
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getHoverInfo({ uri: 'file:///test/file.ts', line: 0, character: 0 });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeHoverProvider',
                expect.any(MockUri),
                expect.any(MockPosition)
            );
        });

        it('should return empty contents when no hover info available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getHoverInfo({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.contents).toEqual([]);
        });
    });
});
