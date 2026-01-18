import * as vscode from 'vscode';
import { z } from 'zod';
import { getKnownDebugSessions, getKnownDebugSessionById, recordDebugSession } from '../utils/debugSessionRegistry';

export const listDebugSessionsSchema = z.object({});

function getSessions(): readonly vscode.DebugSession[] {
    // Some VS Code builds/environments may not expose vscode.debug.sessions.
    const apiSessions = (vscode.debug as unknown as { sessions?: readonly vscode.DebugSession[] })
        .sessions;
    const activeSession = (vscode.debug as unknown as { activeDebugSession?: vscode.DebugSession })
        .activeDebugSession;
    const knownSessions = getKnownDebugSessions();
    if (!apiSessions) {
        const merged = new Map<string, vscode.DebugSession>();
        for (const session of knownSessions) merged.set(session.id, session);
        if (activeSession) merged.set(activeSession.id, activeSession);
        return Array.from(merged.values());
    }

    const merged = new Map<string, vscode.DebugSession>();
    for (const session of apiSessions) merged.set(session.id, session);
    for (const session of knownSessions) merged.set(session.id, session);
    if (activeSession) merged.set(activeSession.id, activeSession);
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
): Promise<{ success: boolean; sessionId?: string; message?: string }> {
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

    const waitForStartEvent = async (): Promise<vscode.DebugSession | undefined> => {
        const debugApi = vscode.debug as unknown as {
            onDidStartDebugSession?: (cb: (s: vscode.DebugSession) => void) => vscode.Disposable;
        };

        if (!debugApi.onDidStartDebugSession) {
            return undefined;
        }

        const expectedType = typeof configuration.type === 'string' ? configuration.type : undefined;
        const expectedName = typeof configuration.name === 'string' ? configuration.name : undefined;

        return await new Promise<vscode.DebugSession | undefined>((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                disposable?.dispose();
                resolve(undefined);
            }, 2000);

            const disposable = debugApi.onDidStartDebugSession?.((session) => {
                const typeOk = expectedType ? session.type === expectedType : true;
                const nameOk = expectedName ? session.name === expectedName : true;
                if (!typeOk || !nameOk) {
                    return;
                }
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                disposable?.dispose();
                resolve(session);
            });
        });
    };

    const startEventPromise = waitForStartEvent();
    const started = await vscode.debug.startDebugging(folder, configuration);
    if (!started) {
        return { success: false, message: 'Failed to start debug session' };
    }

    const startedSession = await startEventPromise;
    if (startedSession) {
        recordDebugSession(startedSession);
        return { success: true, sessionId: startedSession.id, message: 'Debug session started' };
    }

    const activeSession = (vscode.debug as unknown as { activeDebugSession?: vscode.DebugSession })
        .activeDebugSession;
    if (activeSession) {
        recordDebugSession(activeSession);
        return {
            success: true,
            sessionId: activeSession.id,
            message: 'Debug session started (observed via activeDebugSession)',
        };
    }

    return {
        success: true,
        message:
            'Debug session start was requested, but no session id could be observed (it may have terminated immediately or the environment does not expose debug sessions)',
    };
}

export const stopDebugSessionSchema = z.object({
    sessionId: z.string().optional().describe('Stop a specific debug session by id'),
    stopAll: z.boolean().optional().default(false).describe('Stop all debug sessions'),
});

export async function stopDebugSession(
    params: z.infer<typeof stopDebugSessionSchema>
): Promise<{ success: boolean; stopped: number; message?: string }> {
    const sessions = getSessions();
    const activeSession = (vscode.debug as unknown as { activeDebugSession?: vscode.DebugSession })
        .activeDebugSession;

    const toStop = params.stopAll
        ? sessions.length > 0
            ? sessions
            : activeSession
              ? [activeSession]
              : []
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
