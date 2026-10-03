import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Burrowbox, BurrowboxError, type LiveViewCreateParams, type Machine } from "burrowbox";
import { page } from "./page.ts";

const bb = new Burrowbox(); // reads BURROWBOX_KEY
const port = Number(process.env.PORT ?? 3000);
const startUrl = process.env.START_URL ?? "https://en.wikipedia.org/wiki/Burrow";

// Use an existing machine (MACHINE_ID), or create a throwaway one for the demo.
const existingId = process.env.MACHINE_ID;
const machine = existingId ? await bb.machines.get(existingId) : await bb.machines.create({ name: "embed-demo", size: "tiny", ttlMinutes: 60 });

try {
  if (machine.status === "stopped") await bb.machines.start(machine);
  await bb.machines.waitForStatus(machine, "running");
  await openInBrowser(machine, startUrl);

  const server = Bun.serve({
    port,
    routes: {
      "/": new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } }),

      // Links are created on the server: the API key never reaches the browser.
      "/api/live-view": {
        POST: async (req) => {
          const { view, interactive, selector } = (await req.json()) as { view: View; interactive: boolean; selector: string };
          const link = await bb.liveView.create(machine, {
            ...viewParams(view, selector),
            interactive, // false = watch only, enforced on the machine
            ttlSeconds: 15 * 60,
            allowedOrigins: [new URL(req.url).origin], // only this app may frame it
          });
          return Response.json({ url: link.url, expiresAt: link.expiresAt });
        },
      },
    },
    // Send API errors (bad selector, empty balance…) back to the page as JSON.
    error: (err) => Response.json({ error: err.message }, { status: (err instanceof BurrowboxError && err.status) || 500 }),
  });

  console.log(`Live view demo on ${server.url} (Ctrl+C to stop)`);
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.stop();
} finally {
  if (!existingId) {
    await bb.machines.destroy(machine);
    console.log(`Destroyed ${machine.id}`);
  }
}

type View = "desktop" | "desktop-region" | "browser" | "browser-selector";

function viewParams(view: View, selector: string): LiveViewCreateParams {
  switch (view) {
    case "desktop":
      return { mode: "desktop" };
    case "desktop-region": {
      // Top-left quarter of the screen, in screen pixels. Pixels outside it never leave the machine.
      const [width, height] = machine.screen.split("x").map(Number) as [number, number];
      return { mode: "desktop", region: { x: 0, y: 0, width: Math.floor(width / 2), height: Math.floor(height / 2) } };
    }
    case "browser":
      return { mode: "browser" };
    case "browser-selector":
      // Just one element of the page, followed as it scrolls or changes.
      return { mode: "browser", selector };
  }
}

// The SDK has no browser call, so drive the machine's own MCP endpoint, as an agent would.
async function openInBrowser(target: Machine, url: string) {
  const cfg = await bb.machines.mcp(target);
  const mcp = new Client({ name: "embed-live-view", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } }));
  try {
    const result = await mcp.callTool({ name: "browser_navigate", arguments: { url } });
    if (result.isError) throw new Error(`browser_navigate failed: ${JSON.stringify(result.content)}`);
  } finally {
    await mcp.close();
  }
}
