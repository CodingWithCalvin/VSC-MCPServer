import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { goToDefinition, goToDefinitionSchema } from './goToDefinition';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockLocation,
    MockLocationLink,
} from '../test/helpers/mockVscode';

describe('Go To Definition Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = goToDefinitionSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = goToDefinitionSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('goToDefinition', () => {
        it('should return Location definitions', async () => {
            const mockLocations = [
                new MockLocation(
                    MockUri.file('/test/definition.ts'),
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockLocations);

            const result = await goToDefinition({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.definitions).toHaveLength(1);
            expect(result.definitions[0].uri).toContain('definition.ts');
        });

        it('should return LocationLink definitions', async () => {
            const mockLocations = [
                new MockLocationLink(
                    MockUri.file('/test/definition.ts'),
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockLocations);

            const result = await goToDefinition({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.definitions).toHaveLength(1);
            expect(result.definitions[0].targetUri).toBeTruthy();
            expect(result.definitions[0].targetSelectionRange).toBeTruthy();
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await goToDefinition({ uri: 'file:///test/file.ts', line: 0, character: 0 });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeDefinitionProvider',
                expect.any(MockUri),
                expect.any(MockPosition)
            );
        });

        it('should return empty array when no definitions found', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await goToDefinition({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.definitions).toEqual([]);
        });
    });
});
