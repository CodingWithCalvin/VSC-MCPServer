import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getDocumentLinks, documentLinksSchema } from './documentLinks';
import {
    mockVscode,
    resetMocks,
    MockUri,
    MockRange,
    MockPosition,
    MockDocumentLink,
    MockTextDocument,
} from '../test/helpers/mockVscode';

describe('Document Links Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate correct parameters', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = documentLinksSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject missing uri', () => {
            const invalidParams = {};
            const result = documentLinksSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('getDocumentLinks', () => {
        it('should return document links', async () => {
            const mockLinks = [
                new MockDocumentLink(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 30)),
                    MockUri.file('/test/other-file.ts'),
                    'Go to file'
                ),
                new MockDocumentLink(
                    new MockRange(new MockPosition(15, 10), new MockPosition(15, 40)),
                    MockUri.parse('https://example.com'),
                    'Open URL'
                ),
            ];

            mockVscode.commands.getCommands.mockResolvedValue(['vscode.executeDocumentLinkProvider']);
            mockVscode.commands.executeCommand.mockResolvedValue(mockLinks);

            const result = await getDocumentLinks({ uri: '/test/file.ts' });

            expect(result.links).toHaveLength(2);
            expect(result.provider).toBe('vscode');
            expect(result.links[0].target).toContain('other-file.ts');
            expect(result.links[0].tooltip).toBe('Go to file');
            expect(result.links[1].target).toContain('example.com');
        });

        it('should handle links without targets', async () => {
            const mockLinks = [
                new MockDocumentLink(
                    new MockRange(new MockPosition(10, 5), new MockPosition(10, 30)),
                    undefined,
                    undefined
                ),
            ];

            mockVscode.commands.getCommands.mockResolvedValue(['vscode.executeDocumentLinkProvider']);
            mockVscode.commands.executeCommand.mockResolvedValue(mockLinks);

            const result = await getDocumentLinks({ uri: '/test/file.ts' });

            expect(result.links).toHaveLength(1);
            expect(result.provider).toBe('vscode');
            expect(result.links[0].target).toBeUndefined();
            expect(result.links[0].tooltip).toBeUndefined();
        });

        it('should handle file:// URIs', async () => {
            mockVscode.commands.getCommands.mockResolvedValue(['vscode.executeDocumentLinkProvider']);
            mockVscode.commands.executeCommand.mockResolvedValue([]);

            await getDocumentLinks({ uri: 'file:///test/file.ts' });

            expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeDocumentLinkProvider',
                expect.any(MockUri)
            );
        });

        it('should return empty array when no links available', async () => {
            mockVscode.commands.getCommands.mockResolvedValue(['vscode.executeDocumentLinkProvider']);
            mockVscode.commands.executeCommand.mockResolvedValue(null);

            const result = await getDocumentLinks({ uri: '/test/file.ts' });

            expect(result.links).toEqual([]);
            expect(result.provider).toBe('vscode');
        });

        it('falls back to a simple parser when the VS Code provider command is unavailable', async () => {
            mockVscode.commands.getCommands.mockResolvedValue([]);
            mockVscode.workspace.openTextDocument.mockImplementation((uri: MockUri) => {
                return Promise.resolve(
                    new MockTextDocument(
                        uri,
                        'markdown',
                        1,
                        'See https://example.com and [readme](README.md).'
                    )
                );
            });

            const result = await getDocumentLinks({ uri: '/test/file.md' });

            expect(result.provider).toBe('fallback');
            expect(result.links.length).toBeGreaterThanOrEqual(2);
            expect(result.links.some((l) => (l.target || '').includes('example.com'))).toBe(true);
            expect(result.links.some((l) => (l.target || '').includes('README.md'))).toBe(true);
        });
    });
});
