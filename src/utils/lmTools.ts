import * as vscode from 'vscode';

export type LanguageModelToolInfo = {
    name: string;
    description: string;
    tags: readonly string[];
    hasInputSchema: boolean;
    inputSchemaType?: string;
};

export function getLanguageModelToolsSnapshot(): LanguageModelToolInfo[] {
    const tools = vscode.lm?.tools ? Array.from(vscode.lm.tools) : [];
    return tools
        .map((tool) => {
            const schema = tool.inputSchema as { type?: unknown } | undefined;
            const inputSchemaType = typeof schema?.type === 'string' ? schema.type : undefined;
            return {
                name: tool.name,
                description: tool.description ?? '',
                tags: tool.tags ?? [],
                hasInputSchema: !!tool.inputSchema,
                inputSchemaType,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupToolNamesByPrefix(toolNames: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const name of toolNames) {
        // Common naming patterns: "<prefix>_<tool>", "<prefix>.<tool>", "<prefix>:<tool>"
        const match = name.match(/^([^._:]+)[._:]/);
        const prefix = match?.[1] ?? '(no-prefix)';
        const list = groups.get(prefix) ?? [];
        list.push(name);
        groups.set(prefix, list);
    }

    for (const [prefix, names] of groups) {
        names.sort((a, b) => a.localeCompare(b));
        groups.set(prefix, names);
    }

    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

