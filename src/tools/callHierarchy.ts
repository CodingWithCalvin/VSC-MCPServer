import * as vscode from 'vscode';
import { z } from 'zod';
import { rangeToJSON, symbolKindToString, Range, ensureDocumentOpen } from '../adapters/vscodeAdapter';

export const callHierarchySchema = z.object({
    uri: z.string().describe('File URI or absolute file path'),
    line: z.number().describe('0-indexed line number'),
    character: z.number().describe('0-indexed character position'),
    direction: z
        .enum(['incoming', 'outgoing', 'both'])
        .optional()
        .default('both')
        .describe('Direction of calls to retrieve'),
});

export interface CallHierarchyItem {
    name: string;
    kind: string;
    uri: string;
    range: Range;
    selectionRange: Range;
}

export interface IncomingCall {
    from: CallHierarchyItem;
    fromRanges: Range[];
}

export interface OutgoingCall {
    to: CallHierarchyItem;
    fromRanges: Range[];
}

function callHierarchyItemToJSON(item: vscode.CallHierarchyItem): CallHierarchyItem {
    return {
        name: item.name,
        kind: symbolKindToString(item.kind),
        uri: item.uri.toString(),
        range: rangeToJSON(item.range),
        selectionRange: rangeToJSON(item.selectionRange),
    };
}

export async function getCallHierarchy(params: z.infer<typeof callHierarchySchema>): Promise<{
    item?: CallHierarchyItem;
    incomingCalls?: IncomingCall[];
    outgoingCalls?: OutgoingCall[];
}> {
    // Handle both file:// URIs and plain paths
    let uri: vscode.Uri;
    if (params.uri.startsWith('file://')) {
        uri = vscode.Uri.parse(params.uri);
    } else {
        uri = vscode.Uri.file(params.uri);
    }

    // Ensure document is open
    await ensureDocumentOpen(uri);

    const position = new vscode.Position(params.line, params.character);

    // Prepare the call hierarchy
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        uri,
        position
    );

    if (!items || items.length === 0) {
        return { item: undefined };
    }

    const item = items[0];
    const result: {
        item: CallHierarchyItem;
        incomingCalls?: IncomingCall[];
        outgoingCalls?: OutgoingCall[];
    } = {
        item: callHierarchyItemToJSON(item),
    };

    if (params.direction === 'incoming' || params.direction === 'both') {
        const incoming = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
            'vscode.provideIncomingCalls',
            item
        );
        result.incomingCalls = (incoming || []).map((call) => ({
            from: callHierarchyItemToJSON(call.from),
            fromRanges: call.fromRanges.map(rangeToJSON),
        }));
    }

    if (params.direction === 'outgoing' || params.direction === 'both') {
        const outgoing = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
            'vscode.provideOutgoingCalls',
            item
        );
        result.outgoingCalls = (outgoing || []).map((call) => ({
            to: callHierarchyItemToJSON(call.to),
            fromRanges: call.fromRanges.map(rangeToJSON),
        }));
    }

    return result;
}
