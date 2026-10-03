import { query } from "@anthropic-ai/claude-agent-sdk";
import { Burrowbox, toAgentSdkMcpServers } from "burrowbox";

const task = Bun.argv[2] ?? "Open news.ycombinator.com and list the titles of the top 5 stories.";

const bb = new Burrowbox(); // reads BURROWBOX_KEY

// ttlMinutes is a safety net: if this script dies, the machine still turns itself off.
const machine = await bb.machines.create({ name: "quickstart", size: "tiny", ttlMinutes: 30 });
console.log(`Machine ${machine.id} is ${machine.status}`);

try {
  // The machine's MCP endpoint with its own scoped token (tmm_…). No extra request:
  // the token comes with the machine object.
  const mcp = await bb.machines.mcp(machine);

  for await (const message of query({
    prompt: task,
    options: {
      model: "claude-sonnet-5-5",
      mcpServers: toAgentSdkMcpServers(mcp),
      tools: [], // no local tools: Claude works only through the Burrowbox machine
      allowedTools: [`mcp__${mcp.name}`], // every tool on that server, without prompting
      maxTurns: 40,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") console.log(`  → ${block.name}`);
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") console.log(`\n${message.result}`);
      else console.error(`\nAgent stopped: ${message.subtype}`);
      console.log(`(Claude cost $${message.total_cost_usd.toFixed(4)})`);
    }
  }
} finally {
  // Stopping keeps files, apps and browser logins. Use bb.machines.destroy() to delete it.
  await bb.machines.stop(machine);
  console.log(`Machine ${machine.id} stopped`);
}
