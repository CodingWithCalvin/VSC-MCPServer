import * as vscode from 'vscode';

let initialized = false;
const sessions = new Map<string, vscode.DebugSession>();

function addSession(session: vscode.DebugSession) {
    sessions.set(session.id, session);
}

function removeSession(session: vscode.DebugSession) {
    sessions.delete(session.id);
}

export function initDebugSessionRegistry(context: vscode.ExtensionContext): void {
    if (initialized) return;
    initialized = true;

    if (vscode.debug.activeDebugSession) {
        addSession(vscode.debug.activeDebugSession);
    }

    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(addSession),
        vscode.debug.onDidTerminateDebugSession(removeSession)
    );
}

export function getKnownDebugSessions(): vscode.DebugSession[] {
    return Array.from(sessions.values());
}

export function getKnownDebugSessionById(id: string): vscode.DebugSession | undefined {
    return sessions.get(id);
}
