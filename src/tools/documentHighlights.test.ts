import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getDocumentHighlights, documentHighlightsSchema } from './documentHighlights';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockDocumentHighlight,
} from '../test/helpers/mockVscode';

describe('Document Highlights Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = documentHighlightsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = documentHighlightsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getDocumentHighlights', () => {
        it('should return document highlights', async () => {
            const mockHighlights = [
                new MockDocumentHighlight(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                    mockVscode.DocumentHighlightKind.Write
                ),
                new MockDocumentHighlight(
                    new MockRange(new MockPosition(15, 10), new MockPosition(15, 20)),
                    mockVscode.DocumentHighlightKind.Read
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHighlights);

            const result = await getDocumentHighlights({ uri: '/test/file.ts', line: 10, character: 10 });

            expect(result.highlights).toHaveLength(2);
            expect(result.highlights[0].kind).toBe('Write');
            expect(result.highlights[1].kind).toBe('Read');
        });

        it('should handle Text highlight kind', async () => {
            const mockHighlights = [
                new MockDocumentHighlight(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                    mockVscode.DocumentHighlightKind.Text
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHighlights);

            const result = await getDocumentHighlights({ uri: '/test/file.ts', line: 10, character: 10 });

            expect(result.highlights[0].kind).toBe('Text');
        });

        it('should handle undefined highlight kind', async () => {
            const mockHighlights = [
                new MockDocumentHighlight(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15)),
                    undefined
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockHighlights);

            const result = await getDocumentHighlights({ uri: '/test/file.ts', line: 10, character: 10 });

            expect(result.highlights[0].kind).toBe('Unknown');
        });

        it('should return empty array when no highlights found', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getDocumentHighlights({ uri: '/test/file.ts', line: 10, character: 10 });

            expect(result.highlights).toEqual([]);
        });
    });
});
