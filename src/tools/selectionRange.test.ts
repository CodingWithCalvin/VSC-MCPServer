import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getSelectionRange, selectionRangeSchema } from './selectionRange';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockSelectionRange } from '../test/helpers/mockVscode';

describe('Selection Range Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = selectionRangeSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = selectionRangeSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getSelectionRange', () => {
        it('should return selection ranges with hierarchy', async () => {
            const innerRange = new MockSelectionRange(
                new MockRange(new MockPosition(10, 10), new MockPosition(10, 20)),
                undefined
            );
            const middleRange = new MockSelectionRange(
                new MockRange(new MockPosition(10, 5), new MockPosition(10, 25)),
                innerRange
            );
            const outerRange = new MockSelectionRange(
                new MockRange(new MockPosition(10, 0), new MockPosition(10, 30)),
                middleRange
            );

            mockVscode.commands.executeCommand.mockResolvedValue([outerRange]);

            const result = await getSelectionRange({ uri: '/test/file.ts', line: 10, character: 15 });

            expect(result.ranges).toHaveLength(1);
            expect(result.ranges[0].range.startCharacter).toBe(0);
            expect(result.ranges[0].parent?.range.startCharacter).toBe(5);
            expect(result.ranges[0].parent?.parent?.range.startCharacter).toBe(10);
        });

        it('should handle selection range without parent', async () => {
            const mockRange = new MockSelectionRange(
                new MockRange(new MockPosition(10, 0), new MockPosition(10, 30)),
                undefined
            );

            mockVscode.commands.executeCommand.mockResolvedValue([mockRange]);

            const result = await getSelectionRange({ uri: '/test/file.ts', line: 10, character: 15 });

            expect(result.ranges).toHaveLength(1);
            expect(result.ranges[0].parent).toBeUndefined();
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getSelectionRange({ uri: 'file:///test/file.ts', line: 0, character: 0 });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeSelectionRangeProvider',
                expect.any(MockUri),
                expect.any(Array)
            );
        });

        it('should return empty array when no selection ranges available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getSelectionRange({ uri: '/test/file.ts', line: 10, character: 15 });

            expect(result.ranges).toEqual([]);
        });
    });
});
