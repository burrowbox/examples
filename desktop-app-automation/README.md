# Desktop app automation

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

Installs a desktop app on a Burrowbox machine, launches it, and lets Claude use it through the desktop UI.

1. Creates a `small` machine and connects to its [MCP endpoint](https://burrowbox.dev/docs/mcp) with the official MCP TypeScript client, using the config from `bb.machines.mcp(machine)`.
2. Installs LibreOffice Calc with the machine's `apps_install` tool.
3. Opens it with `bb.machines.launchApp()`, which returns once the window is up.
4. Hands the machine's MCP endpoint to Claude (`claude-sonnet-5-5`) with the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), using `toAgentSdkMcpServers(cfg)`. Local tools are off (`tools: []`), and the machine's shell, file and install tools are disallowed, so Claude has to build the spreadsheet in the app with the desktop tools (`screenshot`, `click`, `type_text`, `press_key`…): a small budget table with a `SUM` formula, saved as CSV.
5. Reads the CSV back with `file_read`, saves a screenshot of the final screen to `screen.jpg`, and destroys the machine (also when something fails).

The desktop tools return screenshots, so Claude sees the screen as it works. To follow along, open the machine in the Burrowbox dashboard while the example runs.

## Run

```bash
bun install
bun run start
```

Installing LibreOffice takes a few minutes. The run uses Burrowbox machine time and Claude API tokens.

## Environment

`bun run start` reads `.env` at the repository root (copy `.env.example`).

| Variable | | |
|---|---|---|
| `BURROWBOX_KEY` | required | API key (`tmk_…`) from **Account → API keys** |
| `ANTHROPIC_API_KEY` | required | Anthropic API key, used by the Agent SDK |
