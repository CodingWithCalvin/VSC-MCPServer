import * as vscode from 'vscode';
import { z } from 'zod';
import {
    rangeToJSON,
    diagnosticSeverityToString,
    DiagnosticInfo,
} from '../adapters/vscodeAdapter';

export const diagnosticsSchema = z.object({
    uri: z
        .string()
        .optional()
        .describe('File URI or path. If omitted, returns all workspace diagnostics'),
    severityFilter: z
        .array(z.enum(['Error', 'Warning', 'Information', 'Hint']))
        .optional()
        .describe('Filter by severity levels'),
});

export interface DiagnosticsSummary {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
}

export async function getDiagnostics(params: z.infer<typeof diagnosticsSchema>): Promise<{
    diagnostics: DiagnosticInfo[];
    summary: DiagnosticsSummary;
}> {
    let diagnosticEntries: [vscode.Uri, readonly vscode.Diagnostic[]][];

    if (params.uri) {
        // Handle both file:// URIs and plain paths
        let uri: vscode.Uri;
        if (params.uri.startsWith('file://')) {
            uri = vscode.Uri.parse(params.uri);
        } else {
            uri = vscode.Uri.file(params.uri);
        }
        diagnosticEntries = [[uri, vscode.languages.getDiagnostics(uri)]];
    } else {
        diagnosticEntries = vscode.languages.getDiagnostics();
    }

    let allDiagnostics: DiagnosticInfo[] = diagnosticEntries.flatMap(([uri, diags]) =>
        diags.map((d) => ({
            uri: uri.toString(),
            severity: diagnosticSeverityToString(d.severity),
            message: d.message,
            range: rangeToJSON(d.range),
            source: d.source,
            code:
                typeof d.code === 'object'
                    ? String(d.code.value)
                    : d.code !== undefined
                      ? d.code
                      : undefined,
        }))
    );

    // Apply severity filter
    if (params.severityFilter && params.severityFilter.length > 0) {
        allDiagnostics = allDiagnostics.filter((d) =>
            params.severityFilter!.includes(d.severity as 'Error' | 'Warning' | 'Information' | 'Hint')
        );
    }

    const summary: DiagnosticsSummary = {
        errors: allDiagnostics.filter((d) => d.severity === 'Error').length,
        warnings: allDiagnostics.filter((d) => d.severity === 'Warning').length,
        info: allDiagnostics.filter((d) => d.severity === 'Information').length,
        hints: allDiagnostics.filter((d) => d.severity === 'Hint').length,
    };

    return {
        diagnostics: allDiagnostics,
        summary,
    };
}
