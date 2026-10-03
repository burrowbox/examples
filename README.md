# Burrowbox examples

Example apps and agents built on [Burrowbox](https://burrowbox.dev): persistent Linux computers for AI agents, each with a desktop, a browser that stays signed in, a credential vault and its own MCP endpoint.

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

Each example is a short TypeScript file you run with [Bun](https://bun.sh). No build step, no framework: the code is the point.

## Examples

| Example | What it shows |
|---|---|
| [quickstart](./quickstart) | Create a machine, connect Claude to it over MCP, give it a task, print the result, stop the machine |
| [browser-agent-signed-in](./browser-agent-signed-in) | Store a login in the vault, let the agent sign in once, restart the machine and show it's still signed in |
| [one-machine-per-customer](./one-machine-per-customer) | The platform pattern: one machine per customer, a machine-scoped token for each customer's agent, usage per customer, cleanup |
| [credit-and-errors](./credit-and-errors) | Typed errors (`InsufficientCreditError`, `RateLimitError`, `NotFoundError`…), timeouts and retries, and how to react to each |
| [warm-pool-support-desk](./warm-pool-support-desk) | Claim a pre-booted machine from a warm pool so a customer's agent starts instantly |
| [embed-live-view](./embed-live-view) | Embed a machine's live screen in your own web page |
| [scheduled-jobs-and-webhooks](./scheduled-jobs-and-webhooks) | Cron jobs and inbound webhooks that run inside a machine, plus signed event webhooks |
| [desktop-app-automation](./desktop-app-automation) | Install and drive a desktop app on the machine |

## Setup

You need [Bun](https://bun.sh) 1.2 or later, a Burrowbox API key (**Account → API keys**) and, for the examples that run Claude, an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/burrowbox/examples.git
cd examples
cp .env.example .env   # fill in BURROWBOX_KEY and ANTHROPIC_API_KEY
```

### Use a local build of the SDK (until `burrowbox` is on npm)

The examples depend on `burrowbox@^0.1.0`, which isn't published yet. Until it is, the root `package.json` overrides it with `link:burrowbox`, so build the SDK once and register it with `bun link`:

```bash
git clone https://github.com/burrowbox/burrowbox-js.git ../burrowbox-js
cd ../burrowbox-js && bun install && bun run build && bun link
cd ../examples && bun install
```

After changing the SDK, run `bun run build` in `burrowbox-js` again; the examples pick it up through the link. Once `burrowbox` is published, the `overrides` entry goes away and `bun install` is all you need.

### Run an example

```bash
cd quickstart
bun run start
```

`bun run start` reads the root `.env` (variables already set in your shell win). Each example's README lists what it needs.

Examples create real machines, which cost a few cents an hour while running. Each one stops or destroys what it creates when it finishes, and sets `ttlMinutes` so a crashed run still turns its machine off.

## Adding an example

- Make a folder with a `package.json` (`"private": true`, `"type": "module"`, `"start": "bun --env-file=../.env run index.ts"`, `"burrowbox": "^0.1.0"` in `dependencies`), an `index.ts` and a `README.md` that starts with the **→ Start using Burrowbox** line. The workspace picks up every top-level folder automatically.
- Don't add a `tsconfig.json`: the root one type-checks every `*/**/*.ts` file.
- Check everything with `bun run typecheck` at the root. CI runs the same.
