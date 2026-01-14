import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const documentColorsSchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
});

export interface ColorInfo {
    range: Range;
    color: {
        red: number;
        green: number;
        blue: number;
        alpha: number;
    };
}

export async function getDocumentColors(
    params: z.infer<typeof documentColorsSchema>
): Promise<{ colors: ColorInfo[] }> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const colorInfos = await vscode.commands.executeCommand<vscode.ColorInformation[]>(
        'vscode.executeDocumentColorProvider',
        uri
    );

    if (!colorInfos || colorInfos.length === 0) {
        return { colors: [] };
    }

    const result: ColorInfo[] = colorInfos.map((colorInfo) => ({
        range: rangeToJSON(colorInfo.range),
        color: {
            red: colorInfo.color.red,
            green: colorInfo.color.green,
            blue: colorInfo.color.blue,
            alpha: colorInfo.color.alpha,
        },
    }));

    return { colors: result };
}
