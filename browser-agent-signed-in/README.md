# Browser agent that stays signed in

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

A machine's browser keeps its cookies across restarts, so an agent signs in once and stays signed in. This example:

1. Creates a machine and stores a login in its encrypted vault (`bb.vault.set`).
2. Has Claude sign in with the `browser_login` tool, which fills the form from the vault. Claude never sees the password.
3. Stops the machine, starts it again, and asks Claude whether the browser is still signed in. This time `browser_login` and the vault tools are blocked, so the only way to answer yes is a session that survived the restart.
4. Saves a screenshot of the browser to `signed-in.png` and destroys the machine (it holds a real password).

Claude reports through the Agent SDK's structured output (`outputFormat`), so the script gets `{ signedIn, evidence }` back instead of free text.

Use an account you don't mind an agent using, ideally a test account. Sites that end the session when the browser closes, or that ask for a new device check, won't show the effect.

## Run

```bash
bun install
LOGIN_URL=https://example.com/login LOGIN_USERNAME=bot@example.com LOGIN_PASSWORD=... bun run start
```

## Environment

| Variable | |
|---|---|
| `BURROWBOX_KEY` | Burrowbox API key (`tmk_…`) |
| `ANTHROPIC_API_KEY` | Anthropic API key, used by the Agent SDK |
| `LOGIN_URL` | The site's login page; `browser_login` matches the credential by URL |
| `LOGIN_USERNAME`, `LOGIN_PASSWORD` | The account to sign in with |
| `LOGIN_TOTP_SECRET` | Optional base32 TOTP secret, if the account has 2FA |
