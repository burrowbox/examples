import { query } from "@anthropic-ai/claude-agent-sdk";
import { AuthenticationError, Burrowbox, type Machine, type McpServerConfig, toAgentSdkMcpServers } from "burrowbox";

interface Customer {
  id: string;
  slug: string;
}

// Your customers. In a real app these come from your database.
const customers: Customer[] = [
  { id: "cus_acme", slug: "acme" },
  { id: "cus_globex", slug: "globex" },
];

// Every machine this example creates carries this label, so cleanup finds exactly those.
const labels = { example: "one-machine-per-customer" };

// Your server holds the account API key (tmk_…). Customer agents never get it.
const bb = new Burrowbox();

if (Bun.argv[2] === "cleanup") {
  for (const machine of await bb.machines.list({ labels })) {
    await bb.machines.destroy(machine);
    console.log(`Destroyed ${machine.name} (${machine.externalId})`);
  }
} else {
  await Promise.all(customers.map((customer) => runSession(customer, "Open example.com and tell me the page's main heading.")));

  // What each customer cost you this month, for your own billing.
  const usage = await bb.billing.usage({ groupBy: "externalId" });
  for (const group of usage.groups) {
    console.log(`${group.externalId ?? "(untagged)"}: $${(group.usageMicros / 1e6).toFixed(4)}`);
  }
  console.log("Run `bun run cleanup` to destroy the example machines.");
}

/** One agent session for one customer, on that customer's own machine. */
async function runSession(customer: Customer, task: string) {
  const machine = await machineFor(customer);
  try {
    // All the customer's agent gets: its machine's MCP URL and scoped token (tmm_…).
    const mcp = await bb.machines.mcp(machine);
    console.log(`[${customer.slug}] machine ${machine.id}, token scoped to it: ${await isScoped(mcp.token)}`);
    console.log(`[${customer.slug}] ${await runAgent(mcp, task)}`);
  } finally {
    await bb.machines.stop(machine); // keeps state for the customer's next session
  }
}

/** The customer's machine: found by their id, created on first use, woken up if it is off. */
async function machineFor(customer: Customer): Promise<Machine> {
  const [existing] = await bb.machines.list({ externalId: customer.id, labels });
  if (!existing) {
    return bb.machines.create({
      name: customer.slug,
      size: "tiny",
      ttlMinutes: 30, // turns itself off, keeping state, if a session is never stopped
      externalId: customer.id, // usage is reported per externalId
      labels,
    });
  }
  switch (existing.status) {
    case "running":
      return existing;
    case "creating":
    case "starting":
      return bb.machines.waitForStatus(existing, "running");
    case "stopping":
      await bb.machines.waitForStatus(existing, "stopped");
  }
  // Resumes exactly where the last session left off, still signed in to everything.
  return bb.machines.start(existing, { ttlMinutes: 30 });
}

/** A machine token is rejected everywhere except its own machine's MCP and live-view endpoints. */
async function isScoped(machineToken: string): Promise<boolean> {
  return new Burrowbox({ apiKey: machineToken }).machines.list().then(
    () => false,
    (err) => err instanceof AuthenticationError,
  );
}

/** The agent side: it knows one MCP URL and one token, nothing else. */
async function runAgent(mcp: McpServerConfig, task: string): Promise<string> {
  for await (const message of query({
    prompt: task,
    options: {
      model: "claude-sonnet-5-5",
      mcpServers: toAgentSdkMcpServers(mcp),
      tools: [],
      allowedTools: [`mcp__${mcp.name}`],
      maxTurns: 20,
    },
  })) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success") throw new Error(`Agent stopped: ${message.subtype}`);
    return message.result;
  }
  throw new Error("Agent ended without a result");
}
