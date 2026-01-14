import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getFoldingRanges, foldingRangesSchema } from './foldingRanges';
import { mockVscode, resetMocks, MockUri, MockFoldingRange } from '../test/helpers/mockVscode';

describe('Folding Ranges Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = foldingRangesSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = foldingRangesSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getFoldingRanges', () => {
        it('should return folding ranges', async () => {
            const mockRanges = [
                new MockFoldingRange(1, 10, mockVscode.FoldingRangeKind.Region),
                new MockFoldingRange(15, 25, mockVscode.FoldingRangeKind.Imports),
                new MockFoldingRange(30, 40, mockVscode.FoldingRangeKind.Comment),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockRanges);

            const result = await getFoldingRanges({ uri: '/test/file.ts' });

            expect(result.ranges).toHaveLength(3);
            expect(result.ranges[0].start).toBe(1);
            expect(result.ranges[0].end).toBe(10);
            expect(result.ranges[0].kind).toBe('Region');
            expect(result.ranges[1].kind).toBe('Imports');
            expect(result.ranges[2].kind).toBe('Comment');
        });

        it('should handle ranges without kind', async () => {
            const mockRanges = [new MockFoldingRange(1, 10, undefined)];

            mockVscode.commands.executeCommand.mockResolvedValue(mockRanges);

            const result = await getFoldingRanges({ uri: '/test/file.ts' });

            expect(result.ranges[0].kind).toBeUndefined();
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getFoldingRanges({ uri: 'file:///test/file.ts' });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeFoldingRangeProvider',
                expect.any(MockUri)
            );
        });

        it('should return empty array when no folding ranges available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getFoldingRanges({ uri: '/test/file.ts' });

            expect(result.ranges).toEqual([]);
        });
    });
});
