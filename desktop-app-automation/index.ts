import { query } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Burrowbox, toAgentSdkMcpServers, type McpServerConfig } from "burrowbox";

const bb = new Burrowbox(); // reads BURROWBOX_KEY

const CSV_PATH = "/tmp/budget.csv";
const TASK = `LibreOffice Calc is open on this Linux desktop with an empty spreadsheet.
Use the desktop tools to work in it like a person would: look at the screen, click and type.

1. In A1:B1 write the headers "Item" and "Cost", and below them these rows: Hosting 120, Domain 15, Email 36.
2. In A5 write "Total", and in B5 a formula that sums B2:B4.
3. Save the sheet as Text CSV to ${CSV_PATH} (keep the CSV format if LibreOffice asks).

Reply with the total shown in B5.`;

const machine = await bb.machines.create({ name: "calc-bot", size: "small", ttlMinutes: 60 });
console.log(`Machine ${machine.id} is ${machine.status}`);
const mcp = new Client({ name: "desktop-app-automation", version: "1.0.0" });

try {
  // The machine's MCP endpoint and its scoped tmm_ token, as plain data.
  const cfg = await bb.machines.mcp(machine);
  await mcp.connect(new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } }));

  // 1. Install the app with the machine's apps_install tool. It stays installed across stops.
  console.log("Installing LibreOffice Calc (takes a few minutes)…");
  await callTool("apps_install", { kind: "apt", packages: ["libreoffice-calc"] }, 15 * 60_000);

  // 2. Launch it. The call returns once its window is open.
  const launched = await bb.machines.launchApp(machine, { command: "libreoffice --calc" });
  console.log(`Launched "${launched.window?.title ?? launched.command}"`);

  // 3. Let Claude drive the desktop.
  console.log(`Claude: ${await letClaudeDrive(cfg)}`);

  // 4. Check the result ourselves, and keep a screenshot of the final screen.
  console.log(`${CSV_PATH}:\n${await callTool("file_read", { path: CSV_PATH })}`);
  await Bun.write("screen.jpg", await bb.machines.screenshot(machine));
  console.log("Saved the final screen to screen.jpg");
} finally {
  await mcp.close();
  await bb.machines.destroy(machine);
  console.log(`Destroyed ${machine.id}`);
}

/** Call a machine MCP tool directly and return its text output. */
async function callTool(name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<string> {
  const result = await mcp.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs });
  const text = (result.content as { type: string; text?: string }[]).map((c) => c.text ?? "").join("\n");
  if (result.isError) throw new Error(`${name} failed: ${text}`);
  return text;
}

/**
 * Claude works through the machine's MCP tools only: no local tools, and no shell or file tools
 * on the machine, so the spreadsheet really is made through the app's UI. Desktop tools return
 * screenshots, so Claude sees what it's doing.
 */
async function letClaudeDrive(cfg: McpServerConfig): Promise<string> {
  const blocked = ["shell_run", "file_write", "file_read", "apps_install", "apps_launch"];
  for await (const message of query({
    prompt: TASK,
    options: {
      model: "claude-sonnet-5-5",
      mcpServers: toAgentSdkMcpServers(cfg),
      tools: [], // no local tools
      allowedTools: [`mcp__${cfg.name}`], // the machine's tools run without prompting…
      disallowedTools: blocked.map((tool) => `mcp__${cfg.name}__${tool}`), // …except these
      maxTurns: 60,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") console.log(`  → ${block.name.replace(`mcp__${cfg.name}__`, "")}`);
      }
    } else if (message.type === "result") {
      console.log(`(Claude cost $${message.total_cost_usd.toFixed(4)})`);
      if (message.subtype !== "success") throw new Error(`Claude stopped: ${message.subtype}`);
      return message.result;
    }
  }
  throw new Error("Claude finished without a result");
}
