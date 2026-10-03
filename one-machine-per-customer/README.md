# One machine per customer

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

The pattern from [Machines for your customers](https://burrowbox.dev/docs/platforms): if your product runs agents for your customers, give each customer their own machine.

- **Find or create.** `machineFor()` looks the customer's machine up by `externalId` (your customer id), creates it on first use, and starts it again when it's off. It resumes where the last session left off, still signed in.
- **Scoped tokens.** The customer's agent only gets the machine's MCP URL and `tmm_` token. That token works on that machine's MCP and live-view endpoints and nowhere else; the script checks this by trying to list machines with it (401).
- **Isolation.** Both customers' agents run at the same time on separate machines.
- **Billing.** Machines are tagged with `externalId`, so `bb.billing.usage({ groupBy: "externalId" })` tells you what each customer cost.
- **Cleanup.** Every machine is labelled `example: one-machine-per-customer`; `bun run cleanup` destroys exactly those.

Sessions end with `stop`, so the machines stay around (stopped machines cost $0.001/h). Run cleanup when you're done.

## Run

```bash
bun install
bun run start     # one agent session per customer
bun run cleanup   # destroy the example's machines
```

## Environment

| Variable | |
|---|---|
| `BURROWBOX_KEY` | Burrowbox API key (`tmk_…`), kept on your server |
| `ANTHROPIC_API_KEY` | Anthropic API key, used by the Agent SDK |
