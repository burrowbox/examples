import { Burrowbox, constructWebhookEvent, WebhookSignatureError } from "burrowbox";

const bb = new Burrowbox(); // reads BURROWBOX_KEY
const port = Number(process.env.PORT ?? 3000);
// Burrowbox only delivers to HTTPS, so expose this server with a tunnel and set its public URL.
const publicUrl = process.env.PUBLIC_URL;
if (!publicUrl) throw new Error("Set PUBLIC_URL to an https:// URL that reaches this server (e.g. a tunnel to port 3000)");

// 1. Register an event endpoint. The signing secret is returned only now.
const endpoint = await bb.events.endpoints.create({
  url: new URL("/burrowbox/events", publicUrl).href,
  events: ["run.succeeded", "run.failed", "machine.stopped", "machine.error"],
  description: "scheduled-jobs-and-webhooks example",
});

let machineId: string | undefined;
let server: Bun.Server<undefined> | undefined;

try {
  // 2. Receive events. Verify the signature over the raw body before trusting anything in it.
  const seen = new Set<string>();
  server = Bun.serve({
    port,
    routes: {
      "/burrowbox/events": {
        POST: async (req) => {
          const rawBody = await req.text();
          try {
            const event = await constructWebhookEvent(rawBody, req.headers.get("Burrowbox-Signature"), endpoint.secret);
            if (seen.has(event.id)) return new Response(null, { status: 204 }); // deliveries can repeat
            seen.add(event.id);

            switch (event.type) {
              case "run.succeeded":
              case "run.failed":
                console.log(`[event] ${event.type}: ${event.data.run.source} ${event.data.run.sourceId} → ${event.data.run.output.trim()}`);
                break;
              case "test":
                console.log(`[event] test: ${event.data.message}`);
                break;
              default:
                console.log(`[event] ${event.type}: ${event.data.machine.name} (${event.data.machine.status})`);
            }
            return new Response(null, { status: 204 });
          } catch (err) {
            if (err instanceof WebhookSignatureError) return new Response("invalid signature", { status: 400 });
            throw err;
          }
        },
      },
    },
  });
  console.log(`Listening on ${server.url}, events arrive at ${endpoint.url}`);

  const test = await bb.events.endpoints.test(endpoint.id);
  console.log(`Test delivery: ${test.ok ? "ok" : `failed (${test.status ?? test.error})`}`);

  // 3. A machine for the jobs to run on. It stops itself after an hour; jobs wake it when due.
  const machine = await bb.machines.create({ name: "jobs-demo", size: "tiny", ttlMinutes: 60 });
  machineId = machine.id;

  // 4. A scheduled job: weekdays at 09:00 UTC, waking the machine and stopping it again afterwards.
  const schedule = await bb.automations.schedules.create(machine, {
    name: "Morning report",
    cron: "0 9 * * mon-fri",
    action: { type: "shell", command: `echo "report for $(date -u +%F), $(uptime -p)"` },
    wakeIfStopped: true,
    stopAfter: true,
  });
  console.log(`Schedule "${schedule.name}" next runs:`, schedule.upcoming.map((t) => new Date(t).toISOString()));

  // Run it now instead of waiting for 09:00. This waits for the result.
  const run = await bb.automations.schedules.run(machine, schedule.id);
  console.log(`Run now: ${run.status}: ${run.output.trim()}`);

  // 5. A webhook: any caller with the URL triggers the action. The request body is saved to a
  //    file whose path is in $BURROWBOX_INPUT_FILE.
  const webhook = await bb.automations.webhooks.create(machine, {
    name: "New order",
    mode: "sync",
    action: {
      type: "shell",
      command: `python3 -c 'import json, os; order = json.load(open(os.environ["BURROWBOX_INPUT_FILE"])); print("packed order", order["order"])'`,
    },
  });
  console.log(`Webhook URL (shown once, keep it secret): ${webhook.url}`);

  // Anything that can send HTTP can call it; webhooks.call is the same as a plain fetch.
  const res = await bb.automations.webhooks.call(webhook.url, { body: { order: 42 } });
  console.log(`Webhook call: HTTP ${res.status}`, await res.json());

  const runs = await bb.automations.runs(machine, { limit: 5 });
  for (const r of runs) console.log(`  ${r.source.padEnd(8)} ${r.status.padEnd(7)} ${r.durationMs ?? "…"} ms`);

  console.log("Waiting for events (Ctrl+C to clean up and exit)");
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
} finally {
  await server?.stop();
  // Destroying the machine also deletes its schedules and webhooks.
  if (machineId) await bb.machines.destroy(machineId);
  await bb.events.endpoints.delete(endpoint.id);
  console.log("Cleaned up the machine and the event endpoint");
}
