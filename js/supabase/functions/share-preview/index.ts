import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_ORIGIN = Deno.env.get("SITE_ORIGIN")!; // 例: https://your-app.example.com

const BOT_USER_AGENTS = [
    "twitterbot",
    "facebookexternalhit",
    "line",
    "discordbot",
    "slackbot",
    "whatsapp",
    "telegrambot",
];

function isBot(userAgent: string){
    const ua = (userAgent || "").toLowerCase();
    return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function escapeHtml(str: string){
    return (str || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c] as string));
}

Deno.serve(async (req) => {

    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");
    const userAgent = req.headers.get("user-agent") || "";

    if (!shareId) {
        return Response.redirect(`${SITE_ORIGIN}/index.html`, 302);
    }

    const targetUrl = `${SITE_ORIGIN}/view.html?share=${shareId}`;

    /* 人間のアクセスは、そのままレシピ閲覧ページへ転送 */
    if (!isBot(userAgent)) {
        return Response.redirect(targetUrl, 302);
    }

    /* クローラーには、OGPタグ付きの簡易HTMLを返す */
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
        .from("shared_recipes")
        .select("recipe_data")
        .eq("short_id", shareId)
        .maybeSingle();

    if (error || !data) {
        return Response.redirect(`${SITE_ORIGIN}/index.html`, 302);
    }

    const recipe = data.recipe_data;
    const title = escapeHtml(recipe.title || "レシピ");
    const desc = escapeHtml(recipe.desc || "レシピをチェックしてみて！");
    const image = recipe.image || "";

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="description" content="${desc}">

<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${image}">
<meta property="og:type" content="article">
<meta property="og:url" content="${targetUrl}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${image}">

<meta http-equiv="refresh" content="0; url=${targetUrl}">
</head>
<body>
<p>${title}のページに移動します...</p>
</body>
</html>`;

    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
});