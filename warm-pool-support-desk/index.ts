import { Burrowbox, BurrowboxError } from "burrowbox";
import { page } from "./page.ts";

const bb = new Burrowbox(); // reads BURROWBOX_KEY
const port = Number(process.env.PORT ?? 3000);

// Every idle machine in the pool runs this template before it counts as ready, so a
// customer gets a desktop with GIMP already open on screen, with no wait.
const pool = await bb.pools.create({
  name: "support-desk",
  size: "tiny",
  target: 2,
  setup: [
    { type: "tool", tool: "apps_install", arguments: { kind: "apt", packages: ["gimp"] } },
    { type: "tool", tool: "apps_launch", arguments: { app: "gimp" } },
  ],
});
console.log(`Created pool ${pool.id}; warming ${pool.target} machines (idle pool machines are billed like running ones)`);

// Machines claimed by this demo, so they can be destroyed on exit.
const claimed = new Set<string>();

try {
  const server = Bun.serve({
    port,
    routes: {
      "/": new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } }),

      "/api/pool": {
        GET: async () => {
          const { ready, warming, target, paused, lastSetup } = await bb.pools.get(pool);
          return Response.json({ ready, warming, target, paused, lastSetupOk: lastSetup?.ok ?? null });
        },
      },

      "/api/sessions": {
        POST: async (req) => {
          const { customerId } = (await req.json()) as { customerId: string };
          const started = performance.now();

          // Instant when the pool has a ready machine (fromPool: true). If it's empty, a new
          // machine boots with the pool's settings (fromPool: false) and setup runs in the background.
          const machine = await bb.pools.claim(pool, {
            name: `support-${customerId}`,
            externalId: customerId,
            labels: { app: "support-desk" },
            ttlMinutes: 30,
            onExpire: "destroy",
          });
          claimed.add(machine.id);
          const claimMs = Math.round(performance.now() - started);

          const liveView = await bb.liveView.create(machine, {
            interactive: true,
            ttlSeconds: 30 * 60,
            allowedOrigins: [new URL(req.url).origin],
          });

          return Response.json({
            machineId: machine.id,
            fromPool: machine.fromPool,
            setup: machine.setup ?? "done",
            claimMs,
            liveViewUrl: liveView.url,
          });
        },
      },

      "/api/sessions/:id": {
        DELETE: async (req) => {
          const { id } = req.params;
          if (!claimed.has(id)) return Response.json({ error: "not a session from this desk" }, { status: 404 });
          await bb.machines.destroy(id);
          claimed.delete(id);
          return Response.json({ id, ended: true });
        },
      },
    },
    // Send API errors (bad selector, empty balance…) back to the page as JSON.
    error: (err) => Response.json({ error: err.message }, { status: (err instanceof BurrowboxError && err.status) || 500 }),
  });

  console.log(`Support desk on ${server.url} (Ctrl+C to stop and clean up)`);
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.stop();
} finally {
  // Deleting a pool destroys its idle machines but keeps claimed ones, so end those first.
  await Promise.allSettled([...claimed].map((id) => bb.machines.destroy(id)));
  const { destroyedMachines } = await bb.pools.delete(pool);
  console.log(`Ended ${claimed.size} session(s), deleted the pool and ${destroyedMachines} idle machine(s)`);
}
