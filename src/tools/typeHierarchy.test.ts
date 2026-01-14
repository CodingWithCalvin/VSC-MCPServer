import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getTypeHierarchy, typeHierarchySchema } from './typeHierarchy';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockTypeHierarchyItem,
} from '../test/helpers/mockVscode';

describe('Type Hierarchy Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5, direction: 'supertypes' };
            const result = typeHierarchySchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject invalid direction', () => {
            const invalidParams = { uri: '/test/file.ts', line: 10, character: 5, direction: 'invalid' };
            const result = typeHierarchySchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });

        it('should reject missing direction', () => {
            const invalidParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = typeHierarchySchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getTypeHierarchy', () => {
        it('should return supertypes', async () => {
            const item = new MockTypeHierarchyItem(
                mockVscode.SymbolKind.Class,
                'MyClass',
                'detail',
                MockUri.file('/test/file.ts'),
                new MockRange(new MockPosition(10, 0), new MockPosition(50, 0)),
                new MockRange(new MockPosition(10, 6), new MockPosition(10, 13))
            );

            const supertypes = [
                new MockTypeHierarchyItem(
                    mockVscode.SymbolKind.Class,
                    'BaseClass',
                    'base detail',
                    MockUri.file('/test/base.ts'),
                    new MockRange(new MockPosition(1, 0), new MockPosition(20, 0)),
                    new MockRange(new MockPosition(1, 6), new MockPosition(1, 15))
                ),
            ];

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce([item])
                .mockResolvedValueOnce(supertypes);

            const result = await getTypeHierarchy({
                uri: '/test/file.ts',
                line: 10,
                character: 10,
                direction: 'supertypes',
            });

            expect(result.items).toHaveLength(1);
            expect(result.items[0].name).toBe('BaseClass');
        });

        it('should return subtypes', async () => {
            const item = new MockTypeHierarchyItem(
                mockVscode.SymbolKind.Class,
                'BaseClass',
                'detail',
                MockUri.file('/test/base.ts'),
                new MockRange(new MockPosition(1, 0), new MockPosition(20, 0)),
                new MockRange(new MockPosition(1, 6), new MockPosition(1, 15))
            );

            const subtypes = [
                new MockTypeHierarchyItem(
                    mockVscode.SymbolKind.Class,
                    'DerivedClass',
                    'derived detail',
                    MockUri.file('/test/derived.ts'),
                    new MockRange(new MockPosition(10, 0), new MockPosition(50, 0)),
                    new MockRange(new MockPosition(10, 6), new MockPosition(10, 18))
                ),
            ];

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce([item])
                .mockResolvedValueOnce(subtypes);

            const result = await getTypeHierarchy({
                uri: '/test/base.ts',
                line: 1,
                character: 10,
                direction: 'subtypes',
            });

            expect(result.items).toHaveLength(1);
            expect(result.items[0].name).toBe('DerivedClass');
        });

        it('should return empty items when no type hierarchy available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getTypeHierarchy({
                uri: '/test/file.ts',
                line: 10,
                character: 10,
                direction: 'supertypes',
            });

            expect(result.items).toEqual([]);
        });
    });
});
