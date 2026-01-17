import * as vscode from 'vscode';
import { z } from 'zod';

export const listDebugSessionsSchema = z.object({});

export async function listDebugSessions(): Promise<{
    sessions: Array<{ id: string; name: string; type: string }>;
}> {
    return {
        sessions: vscode.debug.sessions.map((s) => ({
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
    const sessions = vscode.debug.sessions;

    const toStop = params.stopAll
        ? sessions
        : params.sessionId
          ? sessions.filter((s) => s.id === params.sessionId)
          : [];

    if (toStop.length === 0) {
        return { success: false, stopped: 0, message: 'No matching debug sessions' };
    }

    let stopped = 0;
    for (const session of toStop) {
        const ok = await vscode.debug.stopDebugging(session);
        if (ok) stopped++;
    }

    return { success: stopped > 0, stopped, message: `Stopped ${stopped} session(s)` };
}

export const restartDebugSessionSchema = z.object({
    sessionId: z.string().describe('Debug session id to restart'),
});

export async function restartDebugSession(
    params: z.infer<typeof restartDebugSessionSchema>
): Promise<{ success: boolean; message?: string }> {
    const session = vscode.debug.sessions.find((s) => s.id === params.sessionId);
    if (!session) {
        return { success: false, message: 'Debug session not found' };
    }

    const stopped = await vscode.debug.stopDebugging(session);
    if (!stopped) {
        return { success: false, message: 'Failed to stop debug session' };
    }

    const folder = session.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
    const started = await vscode.debug.startDebugging(folder, session.configuration);
    return started
        ? { success: true, message: 'Debug session restarted' }
        : { success: false, message: 'Failed to restart debug session' };
}
