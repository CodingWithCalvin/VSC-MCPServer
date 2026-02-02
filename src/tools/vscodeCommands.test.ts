import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import {
    listVSCodeCommands,
    listVSCodeCommandsSchema,
    executeVSCodeCommand,
    executeVSCodeCommandSchema,
} from './vscodeCommands';
import { mockVscode, resetMocks } from '../test/helpers/mockVscode';

describe('VS Code command tools', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('lists commands', async () => {
        mockVscode.commands.getCommands.mockResolvedValue(['a', 'b']);

        const result = await listVSCodeCommands(listVSCodeCommandsSchema.parse({}));

        expect(result.commands).toEqual(['a', 'b']);
        expect(mockVscode.commands.getCommands).toHaveBeenCalledWith(false);
    });

    it('blocks execute_vscode_command when unsafe tools disabled', async () => {
        (mockVscode.workspace.getConfiguration as any).mockReturnValue({
            get: (key: string, defaultValue: any) => {
                if (key === 'enableUnsafeTools') return false;
                return defaultValue;
            },
            update: vi.fn(),
        });

        const result = await executeVSCodeCommand(
            executeVSCodeCommandSchema.parse({ command: 'workbench.action.files.newUntitledFile' })
        );

        expect(result.success).toBe(false);
        expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('executes command when unsafe tools enabled', async () => {
        (mockVscode.workspace.getConfiguration as any).mockReturnValue({
            get: (key: string, defaultValue: any) => {
                if (key === 'enableUnsafeTools') return true;
                return defaultValue;
            },
            update: vi.fn(),
        });

        mockVscode.commands.executeCommand.mockResolvedValue('ok');

        const result = await executeVSCodeCommand(
            executeVSCodeCommandSchema.parse({
                command: 'some.command',
                argsJson: '[1,"two"]',
            })
        );

        expect(result.success).toBe(true);
        expect(result.result).toBe('ok');
        expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('some.command', 1, 'two');
    });
});

