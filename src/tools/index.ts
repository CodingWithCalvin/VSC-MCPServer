import { z } from 'zod';

// Import all tool modules
import { openFolder, getOpenFolders, openFolderSchema, getOpenFoldersSchema } from './workspace';
import { getDocumentSymbols, documentSymbolsSchema } from './documentSymbols';
import { getWorkspaceSymbols, workspaceSymbolsSchema } from './workspaceSymbols';
import { goToDefinition, goToDefinitionSchema } from './goToDefinition';
import { findReferences, findReferencesSchema } from './findReferences';
import { getHoverInfo, hoverInfoSchema } from './hoverInfo';
import { getDiagnostics, diagnosticsSchema } from './diagnostics';
import { getCallHierarchy, callHierarchySchema } from './callHierarchy';
import { getCompletions, completionsSchema } from './completions';
import { getSignatureHelp, signatureHelpSchema } from './signatureHelp';
import { getTypeHierarchy, typeHierarchySchema } from './typeHierarchy';
import { getCodeActions, codeActionsSchema } from './codeActions';
import { getDocumentHighlights, documentHighlightsSchema } from './documentHighlights';
import { getFoldingRanges, foldingRangesSchema } from './foldingRanges';
import { getInlayHints, inlayHintsSchema } from './inlayHints';
import { getSemanticTokens, semanticTokensSchema } from './semanticTokens';
import { getCodeLens, codeLensSchema } from './codeLens';
import { getDocumentLinks, documentLinksSchema } from './documentLinks';
import { getSelectionRange, selectionRangeSchema } from './selectionRange';
import { getDocumentColors, documentColorsSchema } from './documentColors';
import { searchWorkspaceFiles, workspaceFileSearchSchema } from './workspaceFileSearch';
import { searchWorkspaceText, workspaceTextSearchSchema } from './workspaceTextSearch';
import { formatDocument, formatDocumentSchema } from './formatDocument';
import { formatRange, formatRangeSchema } from './formatRange';
import { organizeImports, organizeImportsSchema } from './organizeImports';
import { renameSymbol, renameSymbolSchema } from './renameSymbol';
import { applyCodeAction, applyCodeActionSchema } from './applyCodeAction';
import { previewUrl, previewUrlSchema } from './previewUrl';
import { listDirectory, listDirectorySchema } from './listDirectory';
import { focusEditor, focusEditorSchema } from './focusEditor';
import { textEditor, textEditorSchema } from './textEditor';
import {
    executeCommand,
    executeCommandSchema,
    getTerminalOutput,
    getTerminalOutputSchema,
} from './commandExecution';
import {
    listVSCodeCommands,
    listVSCodeCommandsSchema,
    executeVSCodeCommand,
    executeVSCodeCommandSchema,
} from './vscodeCommands';
import {
    listDebugSessions,
    listDebugSessionsSchema,
    startDebugSession,
    startDebugSessionSchema,
    restartDebugSession,
    restartDebugSessionSchema,
    stopDebugSession,
    stopDebugSessionSchema,
} from './debugSessions';

// Tool definition type for MCP
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

// Tool registry
interface ToolEntry {
    definition: ToolDefinition;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
    schema: z.ZodObject<z.ZodRawShape>;
}

function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): ToolDefinition['inputSchema'] {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
        const zodType = value as z.ZodTypeAny;
        const description = zodType.description;

        // Handle optional types
        let innerType = zodType;
        let isOptional = false;

        if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault) {
            isOptional = true;
            innerType = zodType instanceof z.ZodOptional ? zodType.unwrap() : zodType._def.innerType;
        }

        // Convert zod type to JSON schema type
        let jsonType: Record<string, unknown> = { type: 'string' };

        if (innerType instanceof z.ZodString) {
            jsonType = { type: 'string' };
        } else if (innerType instanceof z.ZodNumber) {
            jsonType = { type: 'number' };
        } else if (innerType instanceof z.ZodBoolean) {
            jsonType = { type: 'boolean' };
        } else if (innerType instanceof z.ZodArray) {
            jsonType = { type: 'array', items: { type: 'string' } };
        } else if (innerType instanceof z.ZodEnum) {
            jsonType = { type: 'string', enum: innerType.options };
        }

        if (description) {
            jsonType.description = description;
        }

        properties[key] = jsonType;

        if (!isOptional) {
            required.push(key);
        }
    }

    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
    };
}

const tools: Map<string, ToolEntry> = new Map();

// Register all tools
function registerTool(
    name: string,
    description: string,
    schema: z.ZodObject<z.ZodRawShape>,
    handler: (params: Record<string, unknown>) => Promise<unknown>
): void {
    tools.set(name, {
        definition: {
            name,
            description,
            inputSchema: zodToJsonSchema(schema),
        },
        handler,
        schema,
    });
}

// Register workspace tools
registerTool(
    'open_folder',
    'Open a workspace folder in VSCode',
    openFolderSchema,
    openFolder as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_open_folders',
    'Get the currently open workspace folder(s)',
    getOpenFoldersSchema,
    getOpenFolders as (params: Record<string, unknown>) => Promise<unknown>
);

// Register semantic tools
registerTool(
    'document_symbols',
    'Get all symbols (functions, classes, variables) in a document',
    documentSymbolsSchema,
    getDocumentSymbols as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'workspace_symbols',
    'Search for symbols across the entire workspace',
    workspaceSymbolsSchema,
    getWorkspaceSymbols as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'go_to_definition',
    'Find the definition of a symbol at a specific position',
    goToDefinitionSchema,
    goToDefinition as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'find_references',
    'Find all references to a symbol at a specific position',
    findReferencesSchema,
    findReferences as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'hover_info',
    'Get hover information (type, documentation) for a position',
    hoverInfoSchema,
    getHoverInfo as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'diagnostics',
    'Get diagnostic problems (errors, warnings) for a file or the entire workspace',
    diagnosticsSchema,
    getDiagnostics as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'call_hierarchy',
    'Get incoming and outgoing calls for a function or method',
    callHierarchySchema,
    getCallHierarchy as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_completions',
    'Get code completion suggestions at a position (IntelliSense)',
    completionsSchema,
    getCompletions as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_signature_help',
    'Get function signature and parameter information at a position',
    signatureHelpSchema,
    getSignatureHelp as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_type_hierarchy',
    'Get type hierarchy (supertypes/inheritance or subtypes/implementations)',
    typeHierarchySchema,
    getTypeHierarchy as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_code_actions',
    'Get available code actions (quick fixes, refactorings) for a range',
    codeActionsSchema,
    getCodeActions as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_document_highlights',
    'Get all occurrences of a symbol at a position within the document',
    documentHighlightsSchema,
    getDocumentHighlights as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_folding_ranges',
    'Get collapsible regions (functions, classes, blocks) in a document',
    foldingRangesSchema,
    getFoldingRanges as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_inlay_hints',
    'Get inline parameter names and type hints for a range',
    inlayHintsSchema,
    getInlayHints as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_semantic_tokens',
    'Get detailed semantic token information (types, modifiers) for syntax understanding',
    semanticTokensSchema,
    getSemanticTokens as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_code_lens',
    'Get code lens information (reference counts, test status, etc.) for a document',
    codeLensSchema,
    getCodeLens as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_document_links',
    'Get clickable links (URLs, file paths) found in a document',
    documentLinksSchema,
    getDocumentLinks as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_selection_range',
    'Get semantic selection ranges (expand/shrink selection by syntax nodes)',
    selectionRangeSchema,
    getSelectionRange as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_document_colors',
    'Get color information from a document (CSS colors, theme colors, etc.)',
    documentColorsSchema,
    getDocumentColors as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'search_workspace_files',
    'Search for files in the workspace using glob patterns',
    workspaceFileSearchSchema,
    searchWorkspaceFiles as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'search_workspace_text',
    'Search for text or regex patterns across the workspace (like Ctrl+Shift+F)',
    workspaceTextSearchSchema,
    searchWorkspaceText as (params: Record<string, unknown>) => Promise<unknown>
);

// Write operation tools
registerTool(
    'format_document',
    'Format a document using the configured formatter (supports dry-run)',
    formatDocumentSchema,
    formatDocument as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'format_range',
    'Format a specific range in a document (supports dry-run)',
    formatRangeSchema,
    formatRange as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'organize_imports',
    'Organize and sort import statements in a document (supports dry-run)',
    organizeImportsSchema,
    organizeImports as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'rename_symbol',
    'Rename a symbol across all references in the workspace (supports dry-run)',
    renameSymbolSchema,
    renameSymbol as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'apply_code_action',
    'Apply a specific code action (quick fix or refactoring) by title (supports dry-run)',
    applyCodeActionSchema,
    applyCodeAction as (params: Record<string, unknown>) => Promise<unknown>
);

// Workflow/editor tools
registerTool(
    'execute_command',
    'Execute a shell command (unsafe; gated by configuration)',
    executeCommandSchema,
    executeCommand as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'get_terminal_output',
    'Get output for a previously started execute_command process id',
    getTerminalOutputSchema,
    getTerminalOutput as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'preview_url',
    'Open a URL in VS Code (Simple Browser) or externally',
    previewUrlSchema,
    previewUrl as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'text_editor',
    'Basic file operations: view, replace, insert, create, undo',
    textEditorSchema,
    textEditor as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'list_directory',
    'List directory contents as a tree',
    listDirectorySchema,
    listDirectory as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'focus_editor',
    'Open a file and focus a specific range in the editor',
    focusEditorSchema,
    focusEditor as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'list_debug_sessions',
    'List active debug sessions',
    listDebugSessionsSchema,
    listDebugSessions as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'start_debug_session',
    'Start a new debug session from a JSON debug configuration',
    startDebugSessionSchema,
    startDebugSession as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'restart_debug_session',
    'Restart a running debug session by id',
    restartDebugSessionSchema,
    restartDebugSession as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'stop_debug_session',
    'Stop a debug session by id or stop all sessions',
    stopDebugSessionSchema,
    stopDebugSession as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'list_vscode_commands',
    'List available VS Code command ids',
    listVSCodeCommandsSchema,
    listVSCodeCommands as (params: Record<string, unknown>) => Promise<unknown>
);

registerTool(
    'execute_vscode_command',
    'Execute a VS Code command (unsafe; gated by configuration)',
    executeVSCodeCommandSchema,
    executeVSCodeCommand as (params: Record<string, unknown>) => Promise<unknown>
);

// Export functions
export function getAllTools(): ToolDefinition[] {
    return Array.from(tools.values()).map((entry) => entry.definition);
}

export async function callTool(
    name: string,
    params: Record<string, unknown>
): Promise<unknown> {
    const entry = tools.get(name);

    if (!entry) {
        throw new Error(`Unknown tool: ${name}`);
    }

    // Validate params with zod schema
    const validatedParams = entry.schema.parse(params);

    // Call the handler
    return entry.handler(validatedParams);
}
