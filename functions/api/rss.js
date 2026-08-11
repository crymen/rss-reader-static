const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function invalidHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some(value => value > 255)) return true;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function checkedUrl(value, base) {
  let url;
  try { url = new URL(value, base); } catch { throw new Error("RSS 地址无效"); }
  if (url.protocol !== "https:") throw new Error("RSS 地址必须使用 HTTPS");
  if (url.username || url.password || invalidHost(url.hostname)) throw new Error("不允许访问该地址");
  return url;
}

async function fetchFeed(initialUrl) {
  let url = checkedUrl(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {redirect: "manual", headers: {Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1", "User-Agent": "MixedRSSReader/1.0"}});
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("RSS 重定向次数过多");
      url = checkedUrl(location, url); continue;
    }
    if (!response.ok) throw new Error(`RSS 站点返回 HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new Error("RSS 内容超过 2 MB 限制");
    const reader = response.body?.getReader(); if (!reader) throw new Error("RSS 响应为空");
    const chunks = []; let total = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error("RSS 内容超过 2 MB 限制"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return new TextDecoder().decode(bytes);
  }
  throw new Error("RSS 读取失败");
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url); const rssUrl = url.searchParams.get("url");
  if (!rssUrl) return Response.json({error: "缺少 RSS 地址"}, {status: 400});
  try {
    const xml = await fetchFeed(rssUrl);
    return Response.json({xml}, {headers: {"Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff"}});
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : "RSS 读取失败"}, {status: 400});
  }
}

