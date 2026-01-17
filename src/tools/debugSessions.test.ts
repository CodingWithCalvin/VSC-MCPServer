import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import {
    listDebugSessions,
    startDebugSession,
    stopDebugSession,
    restartDebugSession,
    startDebugSessionSchema,
    stopDebugSessionSchema,
    restartDebugSessionSchema,
} from './debugSessions';
import { mockVscode, resetMocks } from '../test/helpers/mockVscode';

describe('Debug session tools', () => {
    beforeEach(() => {
        resetMocks();
        mockVscode.debug.sessions = [];
    });

    it('lists sessions', async () => {
        mockVscode.debug.sessions = [
            { id: '1', name: 'a', type: 'node' },
            { id: '2', name: 'b', type: 'python' },
        ];

        const result = await listDebugSessions();

        expect(result.sessions).toHaveLength(2);
        expect(result.sessions[0].id).toBe('1');
    });

    it('handles missing vscode.debug.sessions by returning empty list', async () => {
        (mockVscode.debug as any).sessions = undefined;

        const result = await listDebugSessions();

        expect(result.sessions).toEqual([]);
    });

    it('starts a debug session', async () => {
        mockVscode.debug.startDebugging.mockResolvedValue(true);

        const result = await startDebugSession(
            startDebugSessionSchema.parse({
                configurationJson: JSON.stringify({ type: 'node', request: 'launch', name: 'test' }),
            })
        );

        expect(result.success).toBe(true);
        expect(mockVscode.debug.startDebugging).toHaveBeenCalled();
    });

    it('stops all debug sessions', async () => {
        mockVscode.debug.sessions = [{ id: '1', name: 'a', type: 'node' }];
        mockVscode.debug.stopDebugging.mockResolvedValue(undefined);

        const result = await stopDebugSession(stopDebugSessionSchema.parse({ stopAll: true }));

        expect(result.success).toBe(true);
        expect(result.stopped).toBe(1);
        expect(mockVscode.debug.stopDebugging).toHaveBeenCalled();
    });

    it('restarts a debug session', async () => {
        mockVscode.debug.sessions = [
            {
                id: '1',
                name: 'a',
                type: 'node',
                configuration: { type: 'node', request: 'launch', name: 'a' },
                workspaceFolder: mockVscode.workspace.workspaceFolders?.[0],
            },
        ];
        mockVscode.debug.stopDebugging.mockResolvedValue(undefined);
        mockVscode.debug.startDebugging.mockResolvedValue(true);

        const result = await restartDebugSession(restartDebugSessionSchema.parse({ sessionId: '1' }));

        expect(result.success).toBe(true);
        expect(mockVscode.debug.stopDebugging).toHaveBeenCalled();
        expect(mockVscode.debug.startDebugging).toHaveBeenCalled();
    });
});
