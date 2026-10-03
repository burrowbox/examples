# Scheduled jobs and webhooks

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

Runs work inside a machine on a schedule and on demand, and receives Burrowbox's signed event notifications about those runs.

1. **Event endpoint** ([docs](https://burrowbox.dev/docs/events)): registers `PUBLIC_URL/burrowbox/events` for `run.*`, `machine.stopped` and `machine.error`, and sends a `test` event.
2. **Receiver:** a `Bun.serve` route that verifies the `Burrowbox-Signature` header over the raw body with the SDK's `constructWebhookEvent()`, rejects bad signatures with 400 and deduplicates by event id.
3. **Scheduled job** ([docs](https://burrowbox.dev/docs/automations)): a weekday 09:00 UTC shell job with `wakeIfStopped` and `stopAfter`, so a stopped machine wakes for the run and stops again afterwards. It prints the next run times, then runs the job once with `schedules.run()`.
4. **Webhook:** a `sync` webhook whose shell action reads the caller's JSON body from `$BURROWBOX_INPUT_FILE`. It's called with `{ "order": 42 }` and prints the result.
5. Lists recent runs, then keeps listening for events until Ctrl+C. On exit it destroys the machine, which also removes its schedule and webhook, and deletes the event endpoint.

## Run

Burrowbox delivers events only to HTTPS URLs, so expose port 3000 with a tunnel (cloudflared, ngrok, Tailscale Funnel…) and set `PUBLIC_URL` in `.env` to its public URL:

```bash
bun install
bun run start
```

## Environment

`bun run start` reads `.env` at the repository root (copy `.env.example`).

| Variable | | |
|---|---|---|
| `BURROWBOX_KEY` | required | API key (`tmk_…`) from **Account → API keys** |
| `PUBLIC_URL` | required | HTTPS URL that reaches this server. Events are sent to `PUBLIC_URL/burrowbox/events` |
| `PORT` | optional | Local port, default `3000` |
