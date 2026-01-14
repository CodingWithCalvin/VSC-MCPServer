import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getCallHierarchy, callHierarchySchema } from './callHierarchy';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockCallHierarchyItem,
} from '../test/helpers/mockVscode';

describe('Call Hierarchy Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5 };
            const result = callHierarchySchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with direction option', () => {
            const validParams = { uri: '/test/file.ts', line: 10, character: 5, direction: 'incoming' };
            const result = callHierarchySchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject invalid direction', () => {
            const invalidParams = { uri: '/test/file.ts', line: 10, character: 5, direction: 'invalid' };
            const result = callHierarchySchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getCallHierarchy', () => {
        it('should return call hierarchy item with incoming and outgoing calls', async () => {
            const item = new MockCallHierarchyItem(
                mockVscode.SymbolKind.Function,
                'myFunction',
                'detail',
                MockUri.file('/test/file.ts'),
                new MockRange(new MockPosition(10, 0), new MockPosition(20, 0)),
                new MockRange(new MockPosition(10, 9), new MockPosition(10, 19))
            );

            const incomingCalls = [
                {
                    from: new MockCallHierarchyItem(
                        mockVscode.SymbolKind.Function,
                        'caller',
                        'detail',
                        MockUri.file('/test/caller.ts'),
                        new MockRange(new MockPosition(5, 0), new MockPosition(15, 0)),
                        new MockRange(new MockPosition(5, 9), new MockPosition(5, 15))
                    ),
                    fromRanges: [new MockRange(new MockPosition(10, 4), new MockPosition(10, 14))],
                },
            ];

            const outgoingCalls = [
                {
                    to: new MockCallHierarchyItem(
                        mockVscode.SymbolKind.Function,
                        'callee',
                        'detail',
                        MockUri.file('/test/callee.ts'),
                        new MockRange(new MockPosition(1, 0), new MockPosition(10, 0)),
                        new MockRange(new MockPosition(1, 9), new MockPosition(1, 15))
                    ),
                    fromRanges: [new MockRange(new MockPosition(15, 4), new MockPosition(15, 10))],
                },
            ];

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce([item]) // prepareCallHierarchy
                .mockResolvedValueOnce(incomingCalls) // provideIncomingCalls
                .mockResolvedValueOnce(outgoingCalls); // provideOutgoingCalls

            const result = await getCallHierarchy(callHierarchySchema.parse({ uri: '/test/file.ts', line: 10, character: 10 }));

            expect(result.item).toBeTruthy();
            expect(result.item?.name).toBe('myFunction');
            expect(result.incomingCalls).toHaveLength(1);
            expect(result.incomingCalls?.[0].from.name).toBe('caller');
            expect(result.outgoingCalls).toHaveLength(1);
            expect(result.outgoingCalls?.[0].to.name).toBe('callee');
        });

        it('should return only incoming calls when direction is incoming', async () => {
            const item = new MockCallHierarchyItem(
                mockVscode.SymbolKind.Function,
                'myFunction',
                'detail',
                MockUri.file('/test/file.ts'),
                new MockRange(new MockPosition(10, 0), new MockPosition(20, 0)),
                new MockRange(new MockPosition(10, 9), new MockPosition(10, 19))
            );

            mockVscode.commands.executeCommand
                .mockResolvedValueOnce([item])
                .mockResolvedValueOnce([]);

            const result = await getCallHierarchy({
                uri: '/test/file.ts',
                line: 10,
                character: 10,
                direction: 'incoming',
            });

            expect(result.incomingCalls).toBeDefined();
            expect(result.outgoingCalls).toBeUndefined();
        });

        it('should return undefined item when no call hierarchy available', async () => {
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getCallHierarchy(callHierarchySchema.parse({ uri: '/test/file.ts', line: 10, character: 10 }));

            expect(result.item).toBeUndefined();
        });
    });
});
