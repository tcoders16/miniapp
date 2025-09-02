// ---- CONFIG ----
const API_BASE = "http://localhost:3000";       // or set via env and template
const BTN_ID = "__mail_extractor_float_btn";
const TOAST_ID = "__mail_extractor_toast";

// Create / reuse button
function ensureButton() {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.textContent = "Extract →";
  Object.assign(btn.style, {
    position: "fixed",
    zIndex: "2147483647",
    right: "16px",
    bottom: "16px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(24,24,27,.15)",
    background: "linear-gradient(180deg,#111827,#3f3f46)",
    color: "white",
    fontSize: "13px",
    fontFamily: "Inter, system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,.2)",
    cursor: "pointer",
    opacity: "0.95",
  });

  btn.onmouseenter = () => (btn.style.opacity = "1");
  btn.onmouseleave = () => (btn.style.opacity = "0.95");
  btn.onclick = handleExtractClick;

  document.documentElement.appendChild(btn);
}

function toast(msg, ok = true, ms = 1400) {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    Object.assign(el.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "16px",
      bottom: "60px",
      padding: "10px 12px",
      borderRadius: "10px",
      color: "white",
      fontSize: "12px",
      fontFamily: "Inter, system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.2)",
      transition: "transform .2s ease, opacity .2s ease",
      transform: "translateY(10px)",
      opacity: "0"
    });
    document.documentElement.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = ok ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)";
  requestAnimationFrame(() => {
    el.style.transform = "translateY(0)";
    el.style.opacity = "1";
  });
  setTimeout(() => {
    el.style.transform = "translateY(10px)";
    el.style.opacity = "0";
  }, ms);
}

// Gmail scraper
function scrapeGmail() {
  // Subject
  const subj =
    document.querySelector("h2.hP")?.innerText?.trim() || // classic Gmail
    document.querySelector('h1[role="heading"]')?.innerText?.trim() || // new UI
    document.title?.trim() ||
    "email";

  // Body (Gmail uses .a3s for message content; there may be multiple for quoted parts)
  const bodyNodes = [...document.querySelectorAll(".a3s")];
  const text = bodyNodes.length
    ? bodyNodes.map(n => n.innerText.trim()).filter(Boolean).join("\n\n---\n\n")
    : (document.querySelector("main, article")?.innerText ||
       document.body.innerText || "").trim();

  // From (best-effort)
  const from =
    document.querySelector(".gD")?.getAttribute("email") ||
    document.querySelector(".gD")?.getAttribute("data-hovercard-id") ||
    document.querySelector(".gD")?.innerText ||
    undefined;

  return { subject: subj, text, from };
}

// Outlook scraper (simple)
function scrapeOutlook() {
  const subj = document.querySelector('[data-log-name="ReadingPaneSubject"]')?.innerText?.trim()
             || document.title?.trim() || "email";
  const body = document.querySelector('[role="document"]')?.innerText
            || document.querySelector("main, article")?.innerText
            || document.body.innerText || "";
  return { subject: subj, text: body.trim(), from: undefined };
}

function detectProvider() {
  const h = location.hostname;
  if (h.includes("mail.google.com")) return "gmail";
  if (h.includes("outlook.live.com")) return "outlook";
  return "generic";
}

function scrapeCurrent() {
  const p = detectProvider();
  if (p === "gmail") return scrapeGmail();
  if (p === "outlook") return scrapeOutlook();
  // fallback generic
  return {
    subject: document.title?.trim() || "email",
    text: (document.querySelector("main, article")?.innerText || document.body.innerText || "").trim(),
    from: undefined
  };
}

async function handleExtractClick() {
  try {
    toast("Extracting…", true, 900);
    const { subject, text, from } = scrapeCurrent();
    if (!text) {
      toast("No text found on this page", false);
      return;
    }
    const item = { filename: `${subject}.txt`, text };
    const body = {
      items: [item],
      window: "all",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    const r = await fetch(`${API_BASE}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // If you use cookies/session on localhost, add: credentials: "include"
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`${r.status} ${t}`);
    }

    toast("Sent to extractor ✅");
    // Optional: if backend returns events, you could trigger a follow-up here (download ICS, etc.)
    // const data = await r.json();
    // console.log("Extracted:", data);
  } catch (e) {
    console.error(e);
    toast("Extraction failed", false, 1800);
  }
}

// Re-inject button on SPA navigation (Gmail updates DOM without full reload)
function observeRouteChanges() {
  let last = location.href;
  new MutationObserver(() => {
    if (location.href !== last) {
      last = location.href;
      setTimeout(ensureButton, 250);
    }
  }).observe(document, { subtree: true, childList: true });
}

// init
ensureButton();
observeRouteChanges();