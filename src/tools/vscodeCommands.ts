import * as vscode from 'vscode';
import { z } from 'zod';
import { getConfiguration } from '../config/settings';

export const listVSCodeCommandsSchema = z.object({
    includeInternal: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include internal commands (may be a large list)'),
});

export async function listVSCodeCommands(
    params: z.infer<typeof listVSCodeCommandsSchema>
): Promise<{ commands: string[] }> {
    const commands = await vscode.commands.getCommands(params.includeInternal);
    return { commands };
}

export const executeVSCodeCommandSchema = z.object({
    command: z.string().describe('VS Code command id'),
    argsJson: z
        .string()
        .optional()
        .describe('JSON-encoded array of arguments to pass to the command'),
});

export async function executeVSCodeCommand(
    params: z.infer<typeof executeVSCodeCommandSchema>
): Promise<{ success: boolean; result?: unknown; message?: string }> {
    const config = getConfiguration();
    if (!config.enableUnsafeTools) {
        return {
            success: false,
            message:
                'Unsafe tools are disabled. Enable codingwithcalvin.mcp.enableUnsafeTools to use execute_vscode_command.',
        };
    }

    let args: unknown[] = [];
    if (params.argsJson) {
        try {
            const parsed = JSON.parse(params.argsJson);
            if (!Array.isArray(parsed)) {
                return { success: false, message: 'argsJson must be a JSON array' };
            }
            args = parsed;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Failed to parse argsJson: ${errorMessage}` };
        }
    }

    const result = await vscode.commands.executeCommand(params.command, ...args);
    return { success: true, result };
}

