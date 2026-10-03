# Credit and errors

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

How the SDK reports failures and how to react to each. Every API error is a `BurrowboxError` subclass with `status`, `code`, `body` and the request's `method` and `url`.

| Error | When | What this example does |
|---|---|---|
| `NotFoundError` (404) | The machine doesn't exist or isn't yours | Prints the error's fields |
| `InsufficientCreditError` (402) | Empty balance or no card on file | Gets a Stripe Checkout link for a human: save a card, or top up $20 |
| `RateLimitError` (429) | Too many requests, or a limit like 25 machines per account | Waits `retryAfterSeconds` and retries; without it, gives up (destroy unused machines) |
| `ConflictError` (409) | The machine isn't running (vault, screenshots, apps, windows) | Explains that the machine has to be started |
| `TimeoutError`, `ConnectionError` | No response within `timeoutMs`, or a network error | For `create`, looks the machine up by `externalId` before trying again, since it may exist |

Retries and timeouts:

- `new Burrowbox({ timeoutMs, maxRetries })` sets defaults (60 s and 2).
- GET, PUT and DELETE are retried automatically on 408, 429, 5xx and network errors. POST and PATCH are not, which is why the example handles `create` itself.
- Any call takes `{ timeoutMs, maxRetries, signal }` as its last argument to override the defaults for that request.

The example creates one `tiny` machine and destroys it at the end. It doesn't use Claude.

## Run

```bash
bun install
bun run start
```

## Environment

| Variable | |
|---|---|
| `BURROWBOX_KEY` | Burrowbox API key (`tmk_…`) |
