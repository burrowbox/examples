import {
  Burrowbox,
  BurrowboxError,
  ConflictError,
  ConnectionError,
  InsufficientCreditError,
  type Machine,
  type MachineCreateParams,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from "burrowbox";

// Client-wide defaults. GET/PUT/DELETE are retried automatically (maxRetries times) on
// 408/429/5xx and network errors. POST/PATCH are never retried, since they may not be idempotent.
const bb = new Burrowbox({ timeoutMs: 30_000, maxRetries: 3 });

// 404: every API error is a BurrowboxError subclass with status, code and the response body.
try {
  await bb.machines.get("does-not-exist");
} catch (err) {
  if (!(err instanceof NotFoundError)) throw err;
  console.log(`${err.name}: status ${err.status}, code ${err.code}, "${err.message}"`);
}

// Per-request options override the client defaults: fail fast instead of retrying.
try {
  const billing = await bb.billing.get({ timeoutMs: 5_000, maxRetries: 0 });
  console.log(`Balance $${(billing.balanceMicros / 1e6).toFixed(2)}, runway ${billing.runwayHours ?? "∞"} h`);
} catch (err) {
  if (!(err instanceof TimeoutError)) throw err;
  console.log("Billing is slow to answer, carrying on without it");
}

// externalId doubles as an idempotency key for the create below.
const machine = await createMachine({ name: "errors-demo", size: "tiny", ttlMinutes: 10, externalId: `errors-demo-${crypto.randomUUID()}` });

if (machine) {
  try {
    // 409: the vault, screenshots, apps and windows need a running machine.
    await bb.machines.stop(machine);
    try {
      await bb.vault.list(machine);
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      console.log(`${err.name}: ${err.message}. Start the machine first.`);
    }
  } finally {
    await bb.machines.destroy(machine);
    console.log(`Machine ${machine.id} destroyed`);
  }
}

/** Create a machine, reacting to each kind of failure. Returns null when a human has to act. */
async function createMachine(params: MachineCreateParams, attempts = 3): Promise<Machine | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await bb.machines.create(params);
    } catch (err) {
      // 402: empty balance or no card on file. Retrying won't help; send a human to pay.
      if (err instanceof InsufficientCreditError) {
        console.log(`${err.name}: ${err.message}`);
        const { card } = await bb.billing.card.get();
        try {
          const { url } = card ? await bb.billing.topUp({ cents: 2_000 }) : await bb.billing.card.checkout();
          console.log(card ? `Add $20 of credit: ${url}` : `Save a card first: ${url}`);
        } catch (linkErr) {
          // No checkout link (for example a server without payments set up): point to the dashboard.
          if (!(linkErr instanceof BurrowboxError)) throw linkErr;
          console.log(`Open Billing in the dashboard to ${card ? "add credit" : "save a card"}.`);
        }
        return null;
      }

      // 429 with Retry-After: too many requests, wait and try again. Without it, a limit
      // was reached (25 machines per account): destroy machines you no longer need.
      if (err instanceof RateLimitError && err.retryAfterSeconds !== undefined && attempt < attempts) {
        console.log(`Rate limited, retrying in ${err.retryAfterSeconds} s`);
        await Bun.sleep(err.retryAfterSeconds * 1_000);
        continue;
      }

      // No response (network error or TimeoutError): the machine may exist anyway. Look it up
      // by externalId before creating another one.
      if (err instanceof ConnectionError && params.externalId) {
        const [created] = await bb.machines.list({ externalId: params.externalId });
        if (created) return created;
        if (attempt < attempts) continue;
      }

      throw err;
    }
  }
}
