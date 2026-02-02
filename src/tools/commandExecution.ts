import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getConfiguration } from '../config/settings';

type ProcessState = {
    id: string;
    command: string;
    cwd?: string;
    startedAt: number;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    truncated: boolean;
};

const MAX_OUTPUT_CHARS = 200_000;
const processes = new Map<string, ProcessState>();

function appendOutput(state: ProcessState, key: 'stdout' | 'stderr', chunk: Buffer) {
    const text = chunk.toString('utf8');
    state[key] += text;

    const excess = state[key].length - MAX_OUTPUT_CHARS;
    if (excess > 0) {
        state[key] = state[key].slice(excess);
        state.truncated = true;
    }
}

function startProcess(command: string, cwd?: string): {
    state: ProcessState;
    child: ChildProcessWithoutNullStreams;
} {
    const id = randomUUID();
    const state: ProcessState = {
        id,
        command,
        cwd,
        startedAt: Date.now(),
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: '',
        truncated: false,
    };

    const child = spawn(command, {
        cwd,
        shell: true,
        stdio: 'pipe',
        env: process.env,
    });

    child.stdout.on('data', (chunk: Buffer) => appendOutput(state, 'stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => appendOutput(state, 'stderr', chunk));
    child.on('exit', (code, signal) => {
        state.exitCode = code;
        state.signal = signal;
    });

    processes.set(id, state);
    return { state, child };
}

export const executeCommandSchema = z.object({
    command: z.string().describe('Shell command to execute'),
    cwd: z.string().optional().describe('Working directory to run the command in'),
    timeoutMs: z.number().optional().default(60_000).describe('Timeout in milliseconds'),
    background: z.boolean().optional().default(false).describe('Run command in background'),
});

export async function executeCommand(params: z.infer<typeof executeCommandSchema>): Promise<{
    success: boolean;
    id?: string;
    exitCode?: number | null;
    signal?: string | null;
    stdout?: string;
    stderr?: string;
    truncated?: boolean;
    message?: string;
}> {
    const config = getConfiguration();
    if (!config.enableUnsafeTools) {
        return {
            success: false,
            message:
                'Unsafe tools are disabled. Enable codingwithcalvin.mcp.enableUnsafeTools to use execute_command.',
        };
    }

    const { state, child } = startProcess(params.command, params.cwd);

    if (params.background) {
        return {
            success: true,
            id: state.id,
            exitCode: state.exitCode,
            signal: state.signal,
            stdout: state.stdout,
            stderr: state.stderr,
            truncated: state.truncated,
            message: 'Command started in background',
        };
    }

    const timedOut = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
            resolve(true);
        }, params.timeoutMs);

        child.on('exit', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });

    if (timedOut && state.exitCode === null) {
        child.kill('SIGTERM');
        return {
            success: false,
            id: state.id,
            exitCode: state.exitCode,
            signal: state.signal,
            stdout: state.stdout,
            stderr: state.stderr,
            truncated: state.truncated,
            message: `Command timed out after ${params.timeoutMs}ms`,
        };
    }

    return {
        success: true,
        id: state.id,
        exitCode: state.exitCode,
        signal: state.signal,
        stdout: state.stdout,
        stderr: state.stderr,
        truncated: state.truncated,
    };
}

export const getTerminalOutputSchema = z.object({
    id: z.string().describe('Process id returned by execute_command'),
    clear: z.boolean().optional().default(false).describe('Clear stored output after reading'),
});

export async function getTerminalOutput(params: z.infer<typeof getTerminalOutputSchema>): Promise<{
    success: boolean;
    id: string;
    running: boolean;
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    truncated: boolean;
    message?: string;
}> {
    const state = processes.get(params.id);
    if (!state) {
        return {
            success: false,
            id: params.id,
            running: false,
            exitCode: null,
            signal: null,
            stdout: '',
            stderr: '',
            truncated: false,
            message: 'Unknown process id',
        };
    }

    const result = {
        success: true,
        id: state.id,
        running: state.exitCode === null && state.signal === null,
        exitCode: state.exitCode,
        signal: state.signal,
        stdout: state.stdout,
        stderr: state.stderr,
        truncated: state.truncated,
    };

    if (params.clear) {
        state.stdout = '';
        state.stderr = '';
        state.truncated = false;
    }

    return result;
}

