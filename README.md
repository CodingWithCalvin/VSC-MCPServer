# 🔌 VSC as MCP

**🚀 Supercharge your AI coding assistants with VS Code's powerful language intelligence!**

A Visual Studio Code extension that exposes an MCP (Model Context Protocol) server, giving AI tools like Claude, Cursor, and others direct access to VS Code's semantic code understanding capabilities - go-to-definition, find references, completions, diagnostics, and so much more!

---

[![License](https://img.shields.io/github/license/CodingWithCalvin/VSC-MCPServer?style=for-the-badge)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/CodingWithCalvin/VSC-MCPServer/build.yml?style=for-the-badge)](https://github.com/CodingWithCalvin/VSC-MCPServer/actions/workflows/build.yml)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/CodingWithCalvin.VSC-MCPServer?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)
[![VS Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/CodingWithCalvin.VSC-MCPServer?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)
[![VS Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/CodingWithCalvin.VSC-MCPServer?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)
[![VS Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/CodingWithCalvin.VSC-MCPServer?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)

---

## ✨ Features

- **🧠 Full Language Intelligence** - Access VS Code's language server features via MCP tools
- **📁 Workspace Aware** - Works on individual files or full project contexts
- **🔗 URI Protocol Handler** - Launch VS Code via `vscode://codingwithcalvin.mcp/...`
- **⚡ Auto-start** - MCP server starts automatically when VS Code launches
- **🔒 Secure by Default** - Binds only to localhost, no external access

---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| 📂 `open_folder` | Open a workspace folder |
| 📋 `get_open_folders` | Get currently open workspace folder(s) |
| 🏷️ `document_symbols` | Get all symbols in a document |
| 🔍 `workspace_symbols` | Search symbols across the workspace |
| 🎯 `go_to_definition` | Find symbol definitions |
| 🔗 `find_references` | Find all references to a symbol |
| 💡 `hover_info` | Get type info and documentation |
| ⚠️ `diagnostics` | Get errors and warnings |
| 📞 `call_hierarchy` | Get incoming/outgoing calls |
| ✏️ `get_completions` | Get code completions at a position |
| 📝 `get_signature_help` | Get function signature help |
| 🏗️ `get_type_hierarchy` | Get type hierarchy information |
| 🔧 `get_code_actions` | Get available code actions/quick fixes |
| 🎯 `get_document_highlights` | Find symbol highlights in a document |
| 🧩 `get_folding_ranges` | Get collapsible regions in a document |
| 🧷 `get_inlay_hints` | Get inlay hints for a range |
| 🧠 `get_semantic_tokens` | Get semantic tokens for syntax understanding |
| 🔎 `get_code_lens` | Get code lens entries for a document |
| 🔗 `get_document_links` | Get clickable links in a document |
| 🪄 `get_selection_range` | Get semantic selection ranges |
| 🎨 `get_document_colors` | Get color information from a document |
| 🔎 `search_workspace_files` | Search for files by pattern |
| 📄 `search_workspace_text` | Search for text across files |
| 🎨 `format_document` | Format an entire document |
| ✂️ `format_range` | Format a specific range |
| 📦 `organize_imports` | Organize imports in a document |
| ✏️ `rename_symbol` | Rename a symbol across the workspace |
| 🛠️ `apply_code_action` | Apply a specific code action (supports dry-run) |
| 🧰 `text_editor` | File ops: view/replace/insert/create/undo |
| 📁 `list_directory` | List directory contents as a tree |
| 🎯 `focus_editor` | Open a file and focus a specific range |
| 🐞 `list_debug_sessions` | List active debug sessions |
| ▶️ `start_debug_session` | Start a debug session from a JSON configuration |
| 🔄 `restart_debug_session` | Restart a debug session by id |
| ⏹️ `stop_debug_session` | Stop a debug session by id or stop all |
| 🧾 `list_vscode_commands` | List available VS Code command ids |
| 🧪 `execute_vscode_command` | Execute a VS Code command (unsafe; gated) |
| 🖥️ `execute_command` | Execute a shell command (unsafe; gated) |
| 📟 `get_terminal_output` | Get output for an `execute_command` process id |
| 🌐 `preview_url` | Open a URL in VS Code or externally |

---

## 📦 Installation

### From VS Code Marketplace

[![VS Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-MCP%20Server-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)

1. Open VS Code
2. Go to **Extensions** (Ctrl+Shift+X)
3. Search for "VSC as MCP"
4. Click **Install**

### Manual Installation

Download the latest `.vsix` from the [Releases](https://github.com/CodingWithCalvin/VSC-MCPServer/releases) page:

```bash
code --install-extension CodingWithCalvin.VSC-MCPServer.vsix
```

---

## 🎯 Usage

The MCP server starts automatically when VS Code launches! Just configure your AI tool to connect:

### MCP Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "vscode": {
      "url": "http://localhost:4000/mcp",
      "description": "VS Code semantic code navigation"
    }
  }
}
```

### ChatGPT Web (ngrok + Google OAuth)

If you want to expose your MCP endpoint to ChatGPT Web, use ngrok as an OAuth-protected proxy in front of the local server.

High-level flow:
- VS Code extension runs locally: `http://127.0.0.1:4000/mcp`
- ngrok enforces Google OAuth (Traffic Policy `oauth` action)
- ngrok forwards requests upstream to your local MCP server

#### Full example (Google OAuth + upstream bearer token)

This example keeps the extension secure by requiring a bearer token, and configures ngrok to:
1) enforce Google OAuth for end users, and
2) inject the bearer token when forwarding upstream to the local MCP server.

1) Configure the extension token (VS Code Settings)

Set a strong token in VS Code settings:
- `codingwithcalvin.mcp.authToken`: `your-long-random-token`

2) Start the MCP server in VS Code

Run `MCP Server: Start`. Confirm locally:

```bash
curl -sS -H "Authorization: Bearer your-long-random-token" http://127.0.0.1:4000/health
```

3) Create an ngrok Traffic Policy

Create `policy.yml`:

```yaml
on_http_request:
  - actions:
      - type: oauth
        config:
          provider: google
          allow_cors_preflight: true
      - type: "add-headers"
        config:
          headers:
            authorization: "Bearer your-long-random-token"
```

4) Start ngrok to your local MCP server

```bash
ngrok http 127.0.0.1:4000 --traffic-policy-file=policy.yml
```

5) Test through the tunnel

Open `https://<your-ngrok-domain>/health` in a browser and complete Google sign-in. You should see:

```json
{"status":"ok","port":4000}
```

Your MCP endpoint via ngrok is:

```
https://<your-ngrok-domain>/mcp
```

In VS Code, you can also run `MCP Server: Connection Info` to see/copy the ngrok URL if the ngrok local dashboard is available at `http://127.0.0.1:4040`.

#### Custom Google OAuth app (optional)

If you want to use your own Google OAuth client:
- Create OAuth client credentials in Google Cloud.
- Set the Redirect/Callback URL to:

```
https://idp.ngrok.com/oauth2/callback
```

Then add `client_id` and `client_secret` under the `oauth` action config in `policy.yml` (see ngrok docs).

ngrok docs:
- `https://ngrok.com/docs/traffic-policy/actions/oauth`
- `https://ngrok.com/docs/traffic-policy/actions/add-headers`

### URI Protocol

Launch VS Code and control the MCP server via URI:

```
vscode://codingwithcalvin.mcp/start                     # Start MCP server
vscode://codingwithcalvin.mcp/start?port=4000           # Start on specific port
vscode://codingwithcalvin.mcp/open?folder=/path/to/dir  # Open folder and start
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `codingwithcalvin.mcp.autoStart` | `true` | 🚀 Auto-start server on VS Code launch |
| `codingwithcalvin.mcp.port` | `4000` | 🔌 MCP server port |
| `codingwithcalvin.mcp.bindAddress` | `127.0.0.1` | 🔒 Bind address (localhost only) |
| `codingwithcalvin.mcp.allowRemoteConnections` | `false` | ⚠️ Allow non-local Host/Origin headers (for tunnels like ngrok). Requires `authToken`. |
| `codingwithcalvin.mcp.authToken` | `""` | 🔑 Optional bearer token. If set, clients must send `Authorization: Bearer <token>`. |
| `codingwithcalvin.mcp.enableUnsafeTools` | `false` | ⚠️ Enable unsafe tools like `execute_command` and `execute_vscode_command` |

---

## 💻 Commands

Access these from the Command Palette (Ctrl+Shift+P):

- **▶️ MCP Server: Start** - Start the MCP server
- **⏹️ MCP Server: Stop** - Stop the MCP server
- **🔄 MCP Server: Restart** - Restart the MCP server
- **📋 MCP Server: Show Available Tools** - View all available MCP tools

---

## 🔒 Security

- 🏠 **Localhost Only** - Binds only to `127.0.0.1`
- 🛡️ **DNS Rebinding Protection** - Validates Host header
- ✅ **Same-machine Trusted** - No authentication required for local access
- ⚠️ **Tunnels/Remote** - If using ngrok, enable `codingwithcalvin.mcp.allowRemoteConnections` and set `codingwithcalvin.mcp.authToken`

---

## 📋 Requirements

- 💻 Visual Studio Code 1.85.0 or later
- 🟢 Node.js (bundled with VS Code)

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests - all feedback helps make this extension better. 💪

### Development Setup

1. 🍴 Clone the repository
2. 📦 Run `npm install`
3. 🔨 Run `npm run build`
4. ▶️ Press F5 to launch the Extension Development Host

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 Contributors

<!-- readme: contributors -start -->
[![CalvinAllen](https://avatars.githubusercontent.com/u/41448698?v=4&s=64)](https://github.com/CalvinAllen) 
<!-- readme: contributors -end -->

---

**⭐ If you find VSC as MCP useful, please consider giving it a star! ⭐**

*Made with ❤️ for the VS Code community by Coding With Calvin*
