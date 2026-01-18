import { describe, it, expect, vi } from 'vitest';

// Mock vscode module - must be before importing tools index (it imports many vscode-dependent tools)
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getAllTools } from './index';

describe('tools schema export', () => {
    it('exports correct JSON schema types for defaulted non-string inputs', () => {
        const tools = getAllTools();
        const listDirectory = tools.find((tool) => tool.name === 'list_directory');
        expect(listDirectory).toBeTruthy();

        const properties = (listDirectory as any).inputSchema?.properties as Record<string, any>;
        expect(properties).toBeTruthy();

        expect(properties.maxDepth?.type).toBe('number');
        expect(properties.includeFiles?.type).toBe('boolean');
        expect(properties.includeDirectories?.type).toBe('boolean');

        const workspaceSymbols = tools.find((tool) => tool.name === 'workspace_symbols');
        expect(workspaceSymbols).toBeTruthy();
        const wsProps = (workspaceSymbols as any).inputSchema?.properties as Record<string, any>;
        expect(wsProps.maxResults?.type).toBe('number');
    });
});
