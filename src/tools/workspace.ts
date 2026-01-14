import * as vscode from 'vscode';
import { z } from 'zod';

export const openFolderSchema = z.object({
    folderPath: z.string().describe('Absolute path to the folder to open'),
    newWindow: z.boolean().optional().default(false).describe('Open in a new window'),
});

export const getOpenFoldersSchema = z.object({});

export async function openFolder(
    params: z.infer<typeof openFolderSchema>
): Promise<{ success: boolean; message: string }> {
    const uri = vscode.Uri.file(params.folderPath);

    try {
        await vscode.commands.executeCommand('vscode.openFolder', uri, {
            forceNewWindow: params.newWindow,
        });
        return {
            success: true,
            message: `Opened folder: ${params.folderPath}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Failed to open folder: ${errorMessage}`,
        };
    }
}

export async function getOpenFolders(): Promise<{
    folders: Array<{ name: string; uri: string; index: number }>;
    workspaceFile?: string;
}> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return { folders: [] };
    }

    return {
        folders: workspaceFolders.map((folder, index) => ({
            name: folder.name,
            uri: folder.uri.toString(),
            index: folder.index,
        })),
        workspaceFile: vscode.workspace.workspaceFile?.toString(),
    };
}
