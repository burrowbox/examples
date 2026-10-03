# Quickstart

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

Creates a Burrowbox machine, connects Claude to it over MCP with the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), gives it a task, prints the result and stops the machine.

- `bb.machines.mcp(machine)` returns the machine's MCP URL and its scoped `tmm_` token, and `toAgentSdkMcpServers()` turns that into the Agent SDK's `mcpServers` option.
- `tools: []` turns off the agent's local tools, so everything it does happens on the machine: browsing, shell, files, desktop apps.
- Stopping keeps the machine's files, apps and browser logins for next time. `ttlMinutes: 30` turns it off even if the script crashes.

## Run

```bash
bun install
bun run start
# or with your own task:
bun run start "Find the current Bun version on bun.sh"
```

## Environment

| Variable | |
|---|---|
| `BURROWBOX_KEY` | Burrowbox API key (`tmk_…`) |
| `ANTHROPIC_API_KEY` | Anthropic API key, used by the Agent SDK |
