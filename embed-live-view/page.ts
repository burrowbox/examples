// The embedding page: pick what to share, then show it in an <iframe>.
export const page = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live view embed</title>
  <style>
    body { font: 15px/1.5 system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
    form { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    select, input, button { font: inherit; padding: .4rem .7rem; }
    #status { color: #555; }
    iframe { width: 100%; aspect-ratio: 16 / 10; border: 1px solid #ccc; border-radius: 6px; margin-top: 1rem; }
    [hidden] { display: none; }
  </style>
</head>
<body>
  <h1>Live view embed</h1>

  <form id="controls">
    <select id="view" aria-label="What to show">
      <option value="desktop">Whole desktop</option>
      <option value="desktop-region">Desktop: top-left quarter (region)</option>
      <option value="browser">Browser</option>
      <option value="browser-selector">Browser: one element (selector)</option>
    </select>
    <input id="selector" value="#firstHeading" aria-label="CSS selector" hidden>
    <label><input type="checkbox" id="interactive"> Interactive</label>
    <button>Show</button>
  </form>

  <p id="status">Choose a view.</p>
  <iframe id="frame" allow="clipboard-read; clipboard-write; fullscreen"></iframe>

  <script>
    const $ = (id) => document.getElementById(id);

    async function show() {
      $("status").textContent = "Creating link…";
      const res = await fetch("/api/live-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: $("view").value, interactive: $("interactive").checked, selector: $("selector").value }),
      });
      const link = await res.json();
      if (!res.ok) return ($("status").textContent = link.error ?? "Could not create a link");
      $("frame").src = link.url;
    }

    $("view").onchange = () => ($("selector").hidden = $("view").value !== "browser-selector");
    $("controls").onsubmit = (e) => { e.preventDefault(); show(); };

    // The viewer reports its state to the embedding page.
    window.addEventListener("message", (e) => {
      if (!$("frame").src.startsWith(e.origin + "/") || e.data?.source !== "burrowbox") return;
      switch (e.data.type) {
        case "connected": $("status").textContent = \`Live: \${e.data.mode}, \${$("interactive").checked ? "interactive" : "watch only"}\`; break;
        case "disconnected": $("status").textContent = "Reconnecting…"; break;
        case "url": $("status").textContent = \`Browser: \${e.data.title} (\${e.data.url})\`; break;
        case "expired": show(); break; // links are short-lived: get a fresh one
      }
    });
  </script>
</body>
</html>`;
