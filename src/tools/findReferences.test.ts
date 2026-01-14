import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { findReferences, findReferencesSchema } from './findReferences';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockLocation } from '../test/helpers/mockVscode';

describe('Find References Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = findReferencesSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with includeDeclaration option', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5, includeDeclaration: false };
            const result = findReferencesSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const invalidParams = { uri: '/test/file.ts' };
            const result = findReferencesSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('findReferences', () => {
        it('should return reference locations', async () => {
            const mockLocations = [
                new MockLocation(
                    MockUri.file('/test/file1.ts'),
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 15))
                ),
                new MockLocation(
                    MockUri.file('/test/file2.ts'),
                    new MockRange(new MockPosition(20, 10), new MockPosition(20, 20))
                ),
            ];

            mockVscode.commands.executeCommand.mockResolvedValue(mockLocations);

            const result = await findReferences({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.references).toHaveLength(2);
            expect(result.totalCount).toBe(2);
            expect(result.references[0].uri).toContain('file1.ts');
            expect(result.references[1].uri).toContain('file2.ts');
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await findReferences({ uri: 'file:///test/file.ts', line: 0, character: 0 });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeReferenceProvider',
                expect.any(MockUri),
                expect.any(MockPosition)
            );
        });

        it('should return empty array when no references found', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await findReferences({ uri: '/test/file.ts', line: 5, character: 10 });

            expect(result.references).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });
});
