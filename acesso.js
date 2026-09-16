// acesso.js — bloqueia a ferramenta se o usuário não tiver permissão.
// Uso, no <head> de cada ferramenta (depois do script do supabase-js):
//   <script src="acesso.js" data-tool="links"></script>
(function () {
  const TOOL = document.currentScript.dataset.tool;
  document.documentElement.style.visibility = "hidden";

  const sb = supabase.createClient(
    "https://iabugpuqlcfftwabuxsj.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhYnVncHVxbGNmZnR3YWJ1eHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTA5MTIsImV4cCI6MjA5MTY2NjkxMn0.Rs2OJlbd8_2TMroE9iehTtZLFdBImVfBpKEH-RT_3UY"
  );

  sb.auth.getUser().then(({ data }) => {
    const u = data?.user;
    if (!u) return location.replace("/");
    const isAdmin = u.user_metadata?.role === "admin";
    const tools = u.app_metadata?.tools;
    const ok = isAdmin || !Array.isArray(tools) || tools.includes(TOOL);
    if (!ok) return location.replace("/");
    document.documentElement.style.visibility = "";
  }).catch(() => location.replace("/"));
})();
