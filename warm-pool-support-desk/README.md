# Warm pool support desk

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

A support desk that hands each customer a ready-made desktop with no boot wait. It creates a [warm pool](https://burrowbox.dev/docs/pools) whose template installs GIMP and opens it on the desktop, so idle machines are already set up. A small `Bun.serve` page has a **Start session** button: it claims a machine for the customer and shows its interactive live view.

- `bb.pools.create({ target, setup })` keeps two machines booted and set up from the template.
- `bb.pools.claim(pool, { externalId, labels, ttlMinutes })` takes one for a customer. `fromPool: true` means it came from the pool. `fromPool: false` means the pool was empty, so a new machine booted with the pool's settings and its setup runs in the background (`setup: "pending"`).
- `bb.liveView.create(machine, { interactive: true, allowedOrigins })` returns a link that only this page can embed.
- **End session** destroys the machine. On exit (Ctrl+C), the app destroys every machine it claimed and deletes the pool. Deleting a pool destroys its idle machines and keeps claimed ones.

Idle pool machines are billed like running machines, so stop the app when you're done.

## Run

```bash
bun install
bun run start
```

Open http://localhost:3000. The first claim may report `fromPool: false` while the pool is still warming up.

## Environment

`bun run start` reads `.env` at the repository root (copy `.env.example`).

| Variable | | |
|---|---|---|
| `BURROWBOX_KEY` | required | API key (`tmk_…`) from **Account → API keys** |
| `PORT` | optional | Port for the page, default `3000` |
