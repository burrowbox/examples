import { query } from "@anthropic-ai/claude-agent-sdk";
import { Burrowbox, type McpServerConfig, toAgentSdkMcpServers } from "burrowbox";

const loginUrl = required("LOGIN_URL");
const credential = {
  url: loginUrl,
  username: required("LOGIN_USERNAME"),
  password: required("LOGIN_PASSWORD"),
  totpSecret: Bun.env.LOGIN_TOTP_SECRET, // optional: browser_login fills the 2FA code too
};

const bb = new Burrowbox();
const machine = await bb.machines.create({ name: "signed-in-browser", size: "tiny", ttlMinutes: 30 });
console.log(`Machine ${machine.id} is ${machine.status}`);

try {
  // Secrets go straight into the machine's encrypted vault. Claude never sees them:
  // browser_login fills the form from the vault inside the machine.
  await bb.vault.set(machine, "site", credential);
  const mcp = await bb.machines.mcp(machine);

  const first = await checkSignIn(
    mcp,
    `Open ${loginUrl} and sign in with the browser_login tool (credential "site"). ` +
      "Then check that you are signed in.",
  );
  console.log("Session 1:", first);
  if (!first.signedIn) throw new Error("Sign-in failed, nothing to show");

  // Turn the machine off. Its disk, browser profile and cookies are snapshotted.
  await bb.machines.stop(machine);
  await bb.machines.waitForStatus(machine, "stopped");
  console.log("Machine stopped");

  await bb.machines.start(machine, { ttlMinutes: 30 });
  await bb.machines.waitForStatus(machine, "running");
  console.log("Machine started again");

  // This time the agent can't sign in: browser_login and the vault tools are removed.
  const second = await checkSignIn(
    mcp,
    `Open ${loginUrl}. Do not try to sign in. Check whether this browser is already signed in.`,
    ["browser_login", "vault_list", "vault_type_secret"],
  );
  console.log("Session 2:", second);

  await Bun.write("signed-in.png", await bb.machines.browserScreenshot(machine));
  console.log("Saved the browser's current page to signed-in.png");
} finally {
  // The vault holds a real password, so delete the machine rather than just stopping it.
  await bb.machines.destroy(machine);
  console.log(`Machine ${machine.id} destroyed`);
}

/** Run Claude on the machine and have it report, as JSON, whether the browser is signed in. */
async function checkSignIn(mcp: McpServerConfig, prompt: string, blockedTools: string[] = []) {
  for await (const message of query({
    prompt,
    options: {
      model: "claude-sonnet-5-5",
      mcpServers: toAgentSdkMcpServers(mcp),
      settingSources: [], // run isolated from your local Claude Code settings, CLAUDE.md and plugins
      strictMcpConfig: true, // only the machine's MCP server, none from your own config
      tools: [],
      allowedTools: [`mcp__${mcp.name}`],
      disallowedTools: blockedTools.map((tool) => `mcp__${mcp.name}__${tool}`),
      outputFormat: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            signedIn: { type: "boolean" },
            evidence: { type: "string", description: "What on the page shows it, e.g. the account name" },
          },
          required: ["signedIn", "evidence"],
          additionalProperties: false,
        },
      },
      maxTurns: 30,
    },
  })) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success") throw new Error(`Agent stopped: ${message.subtype}`);
    return message.structured_output as { signedIn: boolean; evidence: string };
  }
  throw new Error("Agent ended without a result");
}

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`Set ${name} (see README.md)`);
  return value;
}
