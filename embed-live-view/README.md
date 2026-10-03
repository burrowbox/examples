# Embed the live view

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

A `Bun.serve` app that embeds a machine's screen in an `<iframe>` ([docs](https://burrowbox.dev/docs/embed)). The server creates short-lived live-view links, so your API key never reaches the browser. The page lets you choose:

- **What to share:** the whole desktop, a `region` of it (the top-left quarter), the browser, or a single element of the page in the browser (`mode: "browser"` with a CSS `selector`). Pixels outside the chosen area never leave the machine.
- **Watch only or interactive:** `interactive: false` blocks input on the machine itself, not just in the page.

Every link sets `allowedOrigins` to the app's own origin, so other sites can't frame it. The page also listens for the viewer's `postMessage` events (`connected`, `url`, `expired`…) and gets a fresh link when one expires.

At startup the app opens `START_URL` in the machine's browser by calling the machine's own MCP tool `browser_navigate`, the same way an agent would. Without `MACHINE_ID`, it creates a `tiny` machine and destroys it on exit (Ctrl+C).

## Run

```bash
bun install
bun run start
```

Open http://localhost:3000, pick a view and press **Show**. Try **Browser: one element** with selectors such as `#firstHeading` or `#mw-content-text`.

## Environment

`bun run start` reads `.env` at the repository root (copy `.env.example`).

| Variable | | |
|---|---|---|
| `BURROWBOX_KEY` | required | API key (`tmk_…`) from **Account → API keys** |
| `MACHINE_ID` | optional | Use this machine instead of creating one. It's started if stopped and never destroyed |
| `START_URL` | optional | Page to open in the machine's browser, default `https://en.wikipedia.org/wiki/Burrow` |
| `PORT` | optional | Port for the page, default `3000` |
