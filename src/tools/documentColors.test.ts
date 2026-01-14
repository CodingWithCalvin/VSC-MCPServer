import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getDocumentColors, documentColorsSchema } from './documentColors';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockColorInformation } from '../test/helpers/mockVscode';

describe('Document Colors Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.css' };
            const result = documentColorsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = documentColorsSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getDocumentColors', () => {
        it('should return document colors', async () => {
            const mockColors = [
                new MockColorInformation(
                    new MockRange(new MockPosition(5, 10), new MockPosition(5, 17)),
                    { red: 1, green: 0, blue: 0, alpha: 1 }
                ),
                new MockColorInformation(
                    new MockRange(new MockPosition(10, 15), new MockPosition(10, 22)),
                    { red: 0, green: 0.5, blue: 1, alpha: 0.8 }
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockColors);

            const result = await getDocumentColors({ uri: '/test/file.css' });

            expect(result.colors).toHaveLength(2);
            expect(result.colors[0].color.red).toBe(1);
            expect(result.colors[0].color.green).toBe(0);
            expect(result.colors[0].color.blue).toBe(0);
            expect(result.colors[0].color.alpha).toBe(1);
            expect(result.colors[1].color.alpha).toBe(0.8);
        });

        it('should include range information', async () => {
            const mockColors = [
                new MockColorInformation(
                    new MockRange(new MockPosition(5, 10), new MockPosition(5, 17)),
                    { red: 1, green: 0, blue: 0, alpha: 1 }
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockColors);

            const result = await getDocumentColors({ uri: '/test/file.css' });

            expect(result.colors[0].range.startLine).toBe(5);
            expect(result.colors[0].range.startCharacter).toBe(10);
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getDocumentColors({ uri: 'file:///test/file.css' });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeDocumentColorProvider',
                expect.any(MockUri)
            );
        });

        it('should return empty array when no colors available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getDocumentColors({ uri: '/test/file.css' });

            expect(result.colors).toEqual([]);
        });
    });
});
