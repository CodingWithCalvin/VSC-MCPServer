## Remote agent instructions: tool-call tests


### 1) Tool-by-tool smoke test order (sequential)

Goal: run one `tools/call` per tool, in a fixed order, to ensure each tool is reachable and its required params validate.

Set these local variables on the machine running VS Code + the MCP server:

- `REPO_ROOT`: absolute path to the repo root (example: `/home/zeynab/VSC-MCPServer`)
- `TEST_URI`: a file in the workspace (example: `$REPO_ROOT/src/server/mcpServer.ts`)

Recommended call order:

1) `initialize`
2) `tools/list`
3) Run `tools/call` sequentially for each tool (below)

If you only need “which tools, in order”, call them in this exact sequence:

1) `open_folder`
2) `get_open_folders`
3) `document_symbols`
4) `workspace_symbols`
5) `go_to_definition`
6) `find_references`
7) `hover_info`
8) `diagnostics`
9) `call_hierarchy`
10) `get_completions`
11) `get_signature_help`
12) `get_type_hierarchy`
13) `get_code_actions`
14) `get_document_highlights`
15) `get_folding_ranges`
16) `get_inlay_hints`
17) `get_semantic_tokens`
18) `get_code_lens`
19) `get_document_links`
20) `get_selection_range`
21) `get_document_colors`
22) `search_workspace_files`
23) `search_workspace_text`
24) `format_document` (prefer `dryRun: true`)
25) `format_range` (prefer `dryRun: true`)
26) `organize_imports` (prefer `dryRun: true`)
27) `rename_symbol` (prefer `dryRun: true`)
28) `apply_code_action` (prefer `dryRun: true`, usually call `get_code_actions` first)
29) `execute_command` (unsafe; gated by config)
30) `get_terminal_output` (requires an `id` from `execute_command`)
31) `preview_url` (may open UI)
32) `text_editor` (writes unless `action=view` or `dryRun: true`)
33) `list_directory`
34) `focus_editor` (may open UI)
35) `list_debug_sessions`
36) `start_debug_session`
37) `restart_debug_session`
38) `stop_debug_session`
39) `list_vscode_commands`
40) `execute_vscode_command` (unsafe; gated by config)

Notes:
- Tools marked “stateful/unsafe” may change VS Code state or execute commands. Run them only in a disposable workspace.
- For any tool that needs a `(line, character)`, start with `line: 0, character: 0`. If the tool returns empty results, that’s OK for a smoke test; the call should still succeed.
- For any tool that needs a range, start with `startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 10`.
- For “apply” tools, prefer `dryRun: true`.
- If your agent/client “reconnects” (new session / re-initialize), any previously discovered tool endpoints (e.g. `/vscode/link_<id>/...`) may become stale. Always re-run `tools/list` (or the client’s tool discovery) and use the freshly returned tool names/endpoints.

#### Tool list (keys to provide in `params.arguments`)

Use these tool names with `method: "tools/call"` and set `params.name` to the tool name.

| Tool | Params (keys) |
|---|---|
| open_folder | folderPath, newWindow |
| get_open_folders |  |
| document_symbols | uri, query |
| workspace_symbols | query, maxResults |
| go_to_definition | uri, line, character |
| find_references | uri, line, character, includeDeclaration |
| hover_info | uri, line, character |
| diagnostics | uri, severityFilter |
| call_hierarchy | uri, line, character, direction |
| get_completions | uri, line, character, triggerCharacter |
| get_signature_help | uri, line, character |
| get_type_hierarchy | uri, line, character, direction |
| get_code_actions | uri, startLine, startCharacter, endLine, endCharacter, kind |
| get_document_highlights | uri, line, character |
| get_folding_ranges | uri |
| get_inlay_hints | uri, startLine, startCharacter, endLine, endCharacter |
| get_semantic_tokens | uri |
| get_code_lens | uri |
| get_document_links | uri |
| get_selection_range | uri, line, character |
| get_document_colors | uri |
| search_workspace_files | pattern, maxResults, exclude |
| search_workspace_text | query, isRegex, isCaseSensitive, includePattern, excludePattern, maxResults |
| format_document | uri, dryRun |
| format_range | uri, startLine, startCharacter, endLine, endCharacter, dryRun |
| organize_imports | uri, dryRun |
| rename_symbol | uri, line, character, newName, dryRun |
| apply_code_action | uri, startLine, startCharacter, endLine, endCharacter, actionTitle, kind, dryRun |
| execute_command | command, cwd, timeoutMs, background |
| get_terminal_output | id, clear |
| preview_url | url |
| text_editor | action, uri, content, startLine, startCharacter, endLine, endCharacter, text, dryRun |
| list_directory | directoryPath, maxDepth, includeFiles, includeDirectories, excludeHidden, excludeGlobs, maxEntries |
| focus_editor | uri, startLine, startCharacter, endLine, endCharacter, preserveFocus |
| list_debug_sessions |  |
| start_debug_session | workspaceFolderUri, configurationJson |
| restart_debug_session | sessionId |
| stop_debug_session | sessionId, stopAll |
| list_vscode_commands | includeInternal |
| execute_vscode_command | command, argsJson |

#### Minimal smoke-test argument examples (copy/paste)

For “read-only” tools, these examples should validate and run in most workspaces:

- `get_open_folders`: `{}`  
- `list_directory`: `{ "directoryPath": "$REPO_ROOT", "maxDepth": 2, "maxEntries": 100 }`
- `search_workspace_files`: `{ "pattern": "**/*.ts", "maxResults": 20, "exclude": "**/node_modules/**" }`
- `search_workspace_text`: `{ "query": "MCPServer", "isRegex": false, "isCaseSensitive": false, "maxResults": 20 }`
- `workspace_symbols`: `{ "query": "MCPServer", "maxResults": 10 }`
- `document_symbols`: `{ "uri": "$TEST_URI" }`
- `hover_info`: `{ "uri": "$TEST_URI", "line": 0, "character": 0 }`
- `diagnostics`: `{}` (or `{ "uri": "$TEST_URI" }`)

For tools that need a range:

- `get_code_actions`: `{ "uri": "$TEST_URI", "startLine": 0, "startCharacter": 0, "endLine": 0, "endCharacter": 10 }`
- `get_inlay_hints`: `{ "uri": "$TEST_URI", "startLine": 0, "startCharacter": 0, "endLine": 20, "endCharacter": 0 }`

For “apply/write” tools (recommend `dryRun: true`):

- `format_document`: `{ "uri": "$TEST_URI", "dryRun": true }`
- `organize_imports`: `{ "uri": "$TEST_URI", "dryRun": true }`

For dependent tools (two-step):

- `apply_code_action`:
  1) Call `get_code_actions` and pick a returned `title`
  2) Call `apply_code_action` with that `actionTitle` and `dryRun: true`

- `get_terminal_output`:
  1) Call `execute_command` with `{ "command": "echo hello", "background": true }` and capture returned `id`
  2) Call `get_terminal_output` with `{ "id": "<that id>", "clear": true }`
