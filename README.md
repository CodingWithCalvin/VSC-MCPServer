# 🔌 MCP Server for VS Code

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
| 📂 `vscode_open_folder` | Open a workspace folder |
| 📋 `vscode_get_open_folders` | Get currently open workspace folder(s) |
| 🏷️ `vscode_document_symbols` | Get all symbols in a document |
| 🔍 `vscode_workspace_symbols` | Search symbols across the workspace |
| 🎯 `vscode_go_to_definition` | Find symbol definitions |
| 🔗 `vscode_find_references` | Find all references to a symbol |
| 💡 `vscode_hover_info` | Get type info and documentation |
| ⚠️ `vscode_diagnostics` | Get errors and warnings |
| 📞 `vscode_call_hierarchy` | Get incoming/outgoing calls |
| ✏️ `vscode_completions` | Get code completions at a position |
| 📝 `vscode_signature_help` | Get function signature help |
| 🏗️ `vscode_type_hierarchy` | Get type hierarchy information |
| 🔧 `vscode_code_actions` | Get available code actions/quick fixes |
| 🎨 `vscode_format_document` | Format an entire document |
| ✂️ `vscode_format_range` | Format a specific range |
| 📦 `vscode_organize_imports` | Organize imports in a document |
| ✏️ `vscode_rename_symbol` | Rename a symbol across the workspace |
| 🔎 `vscode_workspace_file_search` | Search for files by pattern |
| 📄 `vscode_workspace_text_search` | Search for text across files |

---

## 📦 Installation

### From VS Code Marketplace

[![VS Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-MCP%20Server-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=CodingWithCalvin.VSC-MCPServer)

1. Open VS Code
2. Go to **Extensions** (Ctrl+Shift+X)
3. Search for "MCP Server"
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

**⭐ If you find MCP Server useful, please consider giving it a star! ⭐**

*Made with ❤️ for the VS Code community by Coding With Calvin*
