// api/r.js — redireciona go.institutokaleizu.com.br/:slug e registra o clique.
const FALLBACK = "https://institutokaleizu.com.br";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

function device(ua = "") {
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  res.setHeader("Cache-Control", "no-store");
  if (!slug) { res.writeHead(302, { Location: FALLBACK }); return res.end(); }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  let link;
  try {
    const r = await fetch(`${base}/rest/v1/links_curtos?slug=eq.${slug}&ativo=eq.true&select=*`, { headers: h });
    link = (await r.json())[0];
  } catch (_) {}
  if (!link) { res.writeHead(302, { Location: FALLBACK }); return res.end(); }

  let dest;
  try {
    const u = new URL(link.destino);
    for (const k of UTM) if (link[k] && !u.searchParams.has(k)) u.searchParams.set(k, link[k]);
    // repassa parâmetros extras do link curto (ex.: ?utm_content=story2)
    for (const [k, v] of Object.entries(req.query)) if (k !== "slug") u.searchParams.set(k, v);
    dest = u.toString();
  } catch (_) { dest = link.destino; }

  const ua = req.headers["user-agent"] || "";
  const disp = device(ua);
  if (disp !== "bot") {
    // espera no máximo 800 ms para não atrasar o redirecionamento
    await Promise.race([
      fetch(`${base}/rest/v1/cliques_link`, {
        method: "POST",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({
          link_id: link.id,
          dispositivo: disp,
          pais: req.headers["x-vercel-ip-country"] || null,
          referer: (req.headers.referer || "").slice(0, 300) || null,
          campanha: link.utm_campaign || null,
        }),
      }).catch(() => {}),
      new Promise((r) => setTimeout(r, 800)),
    ]);
  }

  res.writeHead(302, { Location: dest });
  res.end();
};
