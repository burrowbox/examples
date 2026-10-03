// The support agent's page: start a session for a customer and work in the live view.
export const page = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Support desk</title>
  <style>
    body { font: 15px/1.5 system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
    form, .bar { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    input, button { font: inherit; padding: .4rem .7rem; }
    #pool, #info { color: #555; }
    iframe { width: 100%; aspect-ratio: 16 / 10; border: 1px solid #ccc; border-radius: 6px; margin-top: 1rem; }
    [hidden] { display: none; }
  </style>
</head>
<body>
  <h1>Support desk</h1>
  <p id="pool">Loading pool…</p>

  <form id="start">
    <input id="customer" value="cus_8f2a" aria-label="Customer id" required>
    <button>Start session</button>
  </form>

  <section id="session" hidden>
    <div class="bar"><span id="info"></span><button id="end">End session</button></div>
    <iframe id="view" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
  </section>

  <script>
    const $ = (id) => document.getElementById(id);
    let machineId = null;

    async function refreshPool() {
      const p = await fetch("/api/pool").then((r) => r.json());
      $("pool").textContent = p.paused
        ? "Pool paused after failed setups: fix the template."
        : \`Pool: \${p.ready} ready, \${p.warming} warming (target \${p.target})\`;
    }
    refreshPool();
    setInterval(refreshPool, 5000);

    $("start").onsubmit = async (e) => {
      e.preventDefault();
      e.submitter.disabled = true;
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: $("customer").value }),
        });
        const s = await res.json();
        if (!res.ok) throw new Error(s.error);
        machineId = s.machineId;
        $("info").textContent = s.fromPool
          ? \`Machine \${s.machineId} from the warm pool in \${s.claimMs} ms\`
          : \`Pool was empty: booted \${s.machineId} in \${s.claimMs} ms (setup \${s.setup})\`;
        $("view").src = s.liveViewUrl;
        $("session").hidden = false;
        $("start").hidden = true;
      } catch (err) {
        alert(err.message);
      } finally {
        e.submitter.disabled = false;
      }
    };

    $("end").onclick = async () => {
      await fetch("/api/sessions/" + machineId, { method: "DELETE" });
      $("view").src = "about:blank";
      $("session").hidden = true;
      $("start").hidden = false;
    };
  </script>
</body>
</html>`;
