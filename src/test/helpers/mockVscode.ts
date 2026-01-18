import { vi } from 'vitest';

/**
 * Mock VSCode module for unit testing
 * Provides realistic mocks for VSCode APIs without requiring actual VSCode
 */

export class MockPosition {
    constructor(public line: number, public character: number) {}
}

export class MockRange {
    constructor(
        public start: MockPosition,
        public end: MockPosition
    ) {}
}

export class MockSelection extends MockRange {}

export class MockUri {
    constructor(public fsPath: string) {}

    static file(path: string): MockUri {
        return new MockUri(path);
    }

    static parse(uri: string): MockUri {
        return new MockUri(uri.replace('file://', ''));
    }

    toString(): string {
        return `file://${this.fsPath}`;
    }
}

export class MockTextDocument {
    constructor(
        public uri: MockUri,
        public languageId: string,
        public version: number,
        private content: string
    ) {}

    save = vi.fn().mockResolvedValue(true);

    getText(): string {
        return this.content;
    }

    positionAt(offset: number): MockPosition {
        const lines = this.content.substring(0, offset).split('\n');
        return new MockPosition(lines.length - 1, lines[lines.length - 1].length);
    }

    lineAt(line: number) {
        const lines = this.content.split('\n');
        return {
            text: lines[line] || '',
            range: new MockRange(new MockPosition(line, 0), new MockPosition(line, lines[line]?.length || 0)),
        };
    }
}

export class MockTextEdit {
    constructor(
        public range: MockRange,
        public newText: string
    ) {}

    static replace(range: MockRange, newText: string): MockTextEdit {
        return new MockTextEdit(range, newText);
    }
}

export class MockWorkspaceEdit {
    private changes = new Map<string, any[]>();

    set(uri: MockUri, edits: any[]): void {
        this.changes.set(uri.toString(), edits);
    }

    entries(): [MockUri, any[]][] {
        return Array.from(this.changes.entries()).map(([uri, edits]) => [MockUri.parse(uri), edits]);
    }
}

export class MockMarkdownString {
    constructor(public value: string = '', public isTrusted: boolean = false) {}
}

export class MockLocation {
    constructor(public uri: MockUri, public range: MockRange) {}
}

export class MockLocationLink {
    constructor(
        public targetUri: MockUri,
        public targetRange: MockRange,
        public targetSelectionRange: MockRange
    ) {}
}

export class MockCallHierarchyItem {
    constructor(
        public kind: number,
        public name: string,
        public detail: string,
        public uri: MockUri,
        public range: MockRange,
        public selectionRange: MockRange
    ) {}
}

export class MockTypeHierarchyItem {
    constructor(
        public kind: number,
        public name: string,
        public detail: string,
        public uri: MockUri,
        public range: MockRange,
        public selectionRange: MockRange
    ) {}
}

export class MockCodeAction {
    constructor(
        public title: string,
        public kind?: { value: string },
        public edit?: MockWorkspaceEdit,
        public diagnostics?: { message: string }[],
        public isPreferred?: boolean,
        public disabled?: { reason: string }
    ) {}
}

export class MockDiagnostic {
    constructor(
        public range: MockRange,
        public message: string,
        public severity: number,
        public source?: string,
        public code?: string | number | { value: string | number }
    ) {}
}

export class MockHover {
    constructor(
        public contents: (string | MockMarkdownString | { value: string; language?: string })[],
        public range?: MockRange
    ) {}
}

export class MockSignatureHelp {
    constructor(
        public signatures: {
            label: string;
            documentation?: string | MockMarkdownString;
            parameters?: { label: string | [number, number]; documentation?: string | MockMarkdownString }[];
        }[],
        public activeSignature?: number,
        public activeParameter?: number
    ) {}
}

export class MockFoldingRange {
    constructor(
        public start: number,
        public end: number,
        public kind?: number
    ) {}
}

export class MockInlayHint {
    constructor(
        public position: MockPosition,
        public label: string | { value: string }[],
        public kind?: number,
        public tooltip?: string | MockMarkdownString,
        public paddingLeft?: boolean,
        public paddingRight?: boolean
    ) {}
}

export class MockCodeLens {
    constructor(
        public range: MockRange,
        public command?: { title: string; command: string; tooltip?: string }
    ) {}
}

export class MockDocumentLink {
    constructor(
        public range: MockRange,
        public target?: MockUri,
        public tooltip?: string
    ) {}
}

export class MockSelectionRange {
    constructor(
        public range: MockRange,
        public parent?: MockSelectionRange
    ) {}
}

export class MockColorInformation {
    constructor(
        public range: MockRange,
        public color: { red: number; green: number; blue: number; alpha: number }
    ) {}
}

export class MockDocumentHighlight {
    constructor(
        public range: MockRange,
        public kind?: number
    ) {}
}

export class MockSemanticTokens {
    constructor(public data: number[]) {}
}

export class MockSemanticTokensLegend {
    constructor(
        public tokenTypes: string[],
        public tokenModifiers: string[]
    ) {}
}

export const mockVscode = {
    Position: MockPosition,
    Range: MockRange,
    Selection: MockSelection,
    Uri: MockUri,
    TextEdit: MockTextEdit,
    WorkspaceEdit: MockWorkspaceEdit,
    MarkdownString: MockMarkdownString,
    Location: MockLocation,
    LocationLink: MockLocationLink,
    CallHierarchyItem: MockCallHierarchyItem,
    TypeHierarchyItem: MockTypeHierarchyItem,
    CodeAction: MockCodeAction,
    Diagnostic: MockDiagnostic,
    Hover: MockHover,
    SignatureHelp: MockSignatureHelp,
    FoldingRange: MockFoldingRange,
    InlayHint: MockInlayHint,
    CodeLens: MockCodeLens,
    DocumentLink: MockDocumentLink,
    SelectionRange: MockSelectionRange,
    ColorInformation: MockColorInformation,
    DocumentHighlight: MockDocumentHighlight,
    SemanticTokens: MockSemanticTokens,
    SemanticTokensLegend: MockSemanticTokensLegend,

    CompletionItemKind: {
        Text: 0,
        Method: 1,
        Function: 2,
        Constructor: 3,
        Field: 4,
        Variable: 5,
        Class: 6,
        Interface: 7,
        Module: 8,
        Property: 9,
        Unit: 10,
        Value: 11,
        Enum: 12,
        Keyword: 13,
        Snippet: 14,
        Color: 15,
        File: 16,
        Reference: 17,
        Folder: 18,
        EnumMember: 19,
        Constant: 20,
        Struct: 21,
        Event: 22,
        Operator: 23,
        TypeParameter: 24,
    },

    SymbolKind: {
        File: 0,
        Module: 1,
        Namespace: 2,
        Package: 3,
        Class: 4,
        Method: 5,
        Property: 6,
        Field: 7,
        Constructor: 8,
        Enum: 9,
        Interface: 10,
        Function: 11,
        Variable: 12,
        Constant: 13,
        String: 14,
        Number: 15,
        Boolean: 16,
        Array: 17,
        Object: 18,
        Key: 19,
        Null: 20,
        EnumMember: 21,
        Struct: 22,
        Event: 23,
        Operator: 24,
        TypeParameter: 25,
    },

    DocumentHighlightKind: {
        Text: 0,
        Read: 1,
        Write: 2,
    },

    CodeActionKind: {
        QuickFix: { value: 'quickfix' },
        Refactor: { value: 'refactor' },
        SourceOrganizeImports: { value: 'source.organizeImports' },
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },

    FoldingRangeKind: {
        Comment: 1,
        Imports: 2,
        Region: 3,
    },

    InlayHintKind: {
        Type: 1,
        Parameter: 2,
    },

    languages: {
        getDiagnostics: vi.fn(),
    },

    workspace: {
        getConfiguration: vi.fn().mockImplementation(() => ({
            get: vi.fn((_key: string, defaultValue: any) => defaultValue),
            inspect: vi.fn((_key: string) => ({
                key: _key,
                defaultValue: undefined,
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined,
            })),
            update: vi.fn(),
        })),
        openTextDocument: vi.fn().mockImplementation((uri: MockUri) => {
            return Promise.resolve(new MockTextDocument(uri, 'typescript', 1, ''));
        }),
        applyEdit: vi.fn().mockResolvedValue(true),
        workspaceFolders: [{ uri: MockUri.file('/test/workspace'), name: 'test-workspace' }],
        getWorkspaceFolder: vi.fn(),
        findFiles: vi.fn(),
        findTextInFiles: vi.fn(),
        asRelativePath: vi.fn((uri: MockUri) => uri.fsPath.replace('/test/workspace/', '')),
        textDocuments: [],
        fs: {
            writeFile: vi.fn().mockResolvedValue(undefined),
        },
    },

    commands: {
        executeCommand: vi.fn(),
        getCommands: vi.fn().mockResolvedValue([]),
    },

    window: {
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showTextDocument: vi.fn().mockResolvedValue({
            selection: undefined,
            revealRange: vi.fn(),
        }),
    },

    env: {
        openExternal: vi.fn().mockResolvedValue(true),
        clipboard: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
    },

    TextEditorRevealType: {
        InCenter: 0,
    },

    debug: {
        sessions: [] as any[],
        startDebugging: vi.fn().mockResolvedValue(true),
        stopDebugging: vi.fn().mockResolvedValue(undefined),
    },
};

/**
 * Reset all mocks to clean state
 */
export function resetMocks() {
    vi.clearAllMocks();

    // Ensure key mocks keep a safe default implementation after clearAllMocks.
    mockVscode.workspace.getConfiguration.mockImplementation(() => ({
        get: vi.fn((_key: string, defaultValue: any) => defaultValue),
        inspect: vi.fn((_key: string) => ({
            key: _key,
            defaultValue: undefined,
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
        })),
        update: vi.fn(),
    }));

    mockVscode.workspace.openTextDocument.mockImplementation((uri: MockUri) => {
        return Promise.resolve(new MockTextDocument(uri, 'typescript', 1, ''));
    });

    mockVscode.workspace.applyEdit.mockResolvedValue(true);
    mockVscode.workspace.fs.writeFile.mockResolvedValue(undefined);
}
