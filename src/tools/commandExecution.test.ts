import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

vi.mock('child_process', () => {
    return { spawn: vi.fn() };
});

import { spawn } from 'child_process';
import { executeCommand, executeCommandSchema, getTerminalOutput, getTerminalOutputSchema } from './commandExecution';
import { mockVscode, resetMocks } from '../test/helpers/mockVscode';

function createMockChild() {
    const child: any = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
}

describe('execute_command / get_terminal_output', () => {
    beforeEach(() => {
        resetMocks();
        (spawn as any).mockReset();
    });

    it('blocks execute_command when unsafe tools disabled', async () => {
        (mockVscode.workspace.getConfiguration as any).mockReturnValue({
            get: (key: string, defaultValue: any) => {
                if (key === 'enableUnsafeTools') return false;
                return defaultValue;
            },
            update: vi.fn(),
        });

        const result = await executeCommand(executeCommandSchema.parse({ command: 'echo hi' }));

        expect(result.success).toBe(false);
        expect(spawn).not.toHaveBeenCalled();
    });

    it('runs a command and captures output', async () => {
        (mockVscode.workspace.getConfiguration as any).mockReturnValue({
            get: (key: string, defaultValue: any) => {
                if (key === 'enableUnsafeTools') return true;
                return defaultValue;
            },
            update: vi.fn(),
        });

        const child = createMockChild();
        (spawn as any).mockReturnValue(child);

        const promise = executeCommand(
            executeCommandSchema.parse({ command: 'echo hi', timeoutMs: 5000, background: false })
        );

        // Simulate process output + exit.
        child.stdout.emit('data', Buffer.from('hi\n'));
        child.emit('exit', 0, null);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.stdout).toContain('hi');
        expect(result.id).toBeTruthy();

        const out = await getTerminalOutput(getTerminalOutputSchema.parse({ id: result.id! }));
        expect(out.success).toBe(true);
        expect(out.stdout).toContain('hi');
        expect(out.running).toBe(false);
    });
});

