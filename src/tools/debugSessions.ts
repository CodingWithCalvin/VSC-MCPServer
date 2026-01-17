import * as vscode from 'vscode';
import { z } from 'zod';
import { getKnownDebugSessions, getKnownDebugSessionById } from '../utils/debugSessionRegistry';

export const listDebugSessionsSchema = z.object({});

function getSessions(): readonly vscode.DebugSession[] {
    // Some VS Code builds/environments may not expose vscode.debug.sessions.
    const apiSessions = (vscode.debug as unknown as { sessions?: readonly vscode.DebugSession[] })
        .sessions;
    const knownSessions = getKnownDebugSessions();
    if (!apiSessions) return knownSessions;

    const merged = new Map<string, vscode.DebugSession>();
    for (const session of apiSessions) merged.set(session.id, session);
    for (const session of knownSessions) merged.set(session.id, session);
    return Array.from(merged.values());
}

export async function listDebugSessions(): Promise<{
    sessions: Array<{ id: string; name: string; type: string }>;
}> {
    const sessions = getSessions();
    return {
        sessions: sessions.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
        })),
    };
}

export const startDebugSessionSchema = z.object({
    workspaceFolderUri: z
        .string()
        .optional()
        .describe('Optional workspace folder URI (file://...). If omitted, uses active folder.'),
    configurationJson: z
        .string()
        .describe('JSON-encoded debug configuration (same shape as launch.json entry)'),
});

export async function startDebugSession(
    params: z.infer<typeof startDebugSessionSchema>
): Promise<{ success: boolean; message?: string }> {
    let configuration: vscode.DebugConfiguration;
    try {
        configuration = JSON.parse(params.configurationJson) as vscode.DebugConfiguration;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to parse configurationJson: ${errorMessage}` };
    }

    const folder = params.workspaceFolderUri
        ? vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(params.workspaceFolderUri))
        : vscode.workspace.workspaceFolders?.[0];

    const started = await vscode.debug.startDebugging(folder, configuration);
    return started
        ? { success: true, message: 'Debug session started' }
        : { success: false, message: 'Failed to start debug session' };
}

export const stopDebugSessionSchema = z.object({
    sessionId: z.string().optional().describe('Stop a specific debug session by id'),
    stopAll: z.boolean().optional().default(false).describe('Stop all debug sessions'),
});

export async function stopDebugSession(
    params: z.infer<typeof stopDebugSessionSchema>
): Promise<{ success: boolean; stopped: number; message?: string }> {
    const sessions = getSessions();

    const toStop = params.stopAll
        ? sessions
        : params.sessionId
          ? (() => {
                const inSessions = sessions.filter((s) => s.id === params.sessionId);
                if (inSessions.length > 0) return inSessions;
                const known = getKnownDebugSessionById(params.sessionId);
                return known ? [known] : [];
            })()
          : [];

    if (toStop.length === 0) {
        return { success: false, stopped: 0, message: 'No matching debug sessions' };
    }

    let stopped = 0;
    for (const session of toStop) {
        try {
            await vscode.debug.stopDebugging(session);
            stopped++;
        } catch {
            // ignore and continue
        }
    }

    return { success: stopped > 0, stopped, message: `Stopped ${stopped} session(s)` };
}

export const restartDebugSessionSchema = z.object({
    sessionId: z.string().describe('Debug session id to restart'),
});

export async function restartDebugSession(
    params: z.infer<typeof restartDebugSessionSchema>
): Promise<{ success: boolean; message?: string }> {
    const session = getSessions().find((s) => s.id === params.sessionId);
    if (!session) {
        return { success: false, message: 'Debug session not found' };
    }

    try {
        await vscode.debug.stopDebugging(session);
    } catch {
        return { success: false, message: 'Failed to stop debug session' };
    }

    const folder = session.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
    const started = await vscode.debug.startDebugging(folder, session.configuration);
    return started
        ? { success: true, message: 'Debug session restarted' }
        : { success: false, message: 'Failed to restart debug session' };
}
