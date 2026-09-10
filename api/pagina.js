// Serve as páginas arquivadas num endereço limpo, sem exigir login.
// Endereço final: https://seu-dominio.vercel.app/p/<id-do-link>
//
// Precisa de duas variáveis de ambiente no Vercel:
//   SUPABASE_URL          → https://iabugpuqlcfftwabuxsj.supabase.co
//   SUPABASE_SERVICE_KEY  → a chave service_role (Settings → API)
//
// A chave fica só no servidor; nunca chega ao navegador.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function pagina(titulo, msg) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#060B1F;color:#8b93b8;font:400 15px/1.6 -apple-system,'Segoe UI',sans-serif;text-align:center;padding:2rem}
h1{color:#CDA04C;font-size:19px;margin:0 0 8px}</style></head>
<body><div><h1>${titulo}</h1><p>${msg}</p></div></body></html>`;
}

function escapar(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// Coloca o nome do link no título e um selo de cópia arquivada
function identificar(html, link) {
  const titulo = escapar(link.label || "Página arquivada");
  const data = link.arquivado_em
    ? new Date(link.arquivado_em).toLocaleDateString("pt-BR")
    : "";

  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${titulo}</title>`);
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, m => `${m}<title>${titulo}</title>`);
  }

  const selo = `
<div id="kz-selo" style="position:fixed;top:12px;right:12px;z-index:2147483647;
  background:rgba(6,11,31,.94);border:1px solid rgba(205,160,76,.5);border-radius:8px;
  padding:8px 12px;font:400 12px/1.4 -apple-system,'Segoe UI',sans-serif;color:#e8eaf6;
  box-shadow:0 4px 18px rgba(0,0,0,.5);max-width:290px;transition:opacity .4s">
  <div style="color:#CDA04C;font-weight:600;margin-bottom:2px">Cópia arquivada</div>
  <div style="color:#8b93b8;word-break:break-all">${titulo}${data ? " · " + data : ""}</div>
  <div style="color:#3a4060;font-size:11px;margin-top:3px">Formulários e botões não funcionam aqui.</div>
</div>
<script>setTimeout(function(){var e=document.getElementById('kz-selo');
  if(e){e.style.opacity='0';setTimeout(function(){e.remove()},400)}},6000)<\/script>`;

  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, selo + "</body>")
    : html + selo;
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(pagina("Configuração incompleta",
      "As variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não estão definidas no Vercel."));
  }

  const chave = (req.query.id || "").toString().trim();

  // Aceita tanto o apelido (l21-matriculas) quanto o identificador antigo
  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave);
  const ehSlug = /^[a-z0-9][a-z0-9-]{0,79}$/.test(chave);

  if (!ehUuid && !ehSlug) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(pagina("Endereço inválido", "O endereço da página não está correto."));
  }

  const cab = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const filtro = ehUuid
    ? `id=eq.${chave}`
    : `slug=eq.${encodeURIComponent(chave)}`;

  try {
    // 1. Busca o link e o caminho do arquivo
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/links?${filtro}&deleted=eq.false` +
      `&select=label,url,arquivo_path,arquivado_em`, { headers: cab });
    const linhas = await r.json();
    const link = Array.isArray(linhas) ? linhas[0] : null;

    if (!link || !link.arquivo_path) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(pagina("Página não encontrada",
        "Esta página não existe ou ainda não foi arquivada."));
    }

    // 2. Baixa o arquivo do Storage
    const arq = await fetch(
      `${SUPABASE_URL}/storage/v1/object/paginas/${link.arquivo_path}`, { headers: cab });

    if (!arq.ok) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(pagina("Arquivo indisponível", "Não consegui recuperar a cópia salva."));
    }

    const ehPdf = link.arquivo_path.toLowerCase().endsWith(".pdf");

    // Cache de 1 hora: o arquivo não muda depois de enviado
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");

    if (ehPdf) {
      const buf = Buffer.from(await arq.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return res.status(200).send(buf);
    }

    const html = identificar(await arq.text(), link);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);

  } catch (e) {
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(pagina("Erro ao abrir", escapar(e.message)));
  }
}
