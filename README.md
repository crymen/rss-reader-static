# 混合 RSS 阅读器（Cloudflare Pages）

从 Anime Tracker 中独立出来的轻量 RSS/Atom 阅读器。订阅地址保存在浏览器 `localStorage`，无需数据库；Cloudflare Pages Function 负责同源获取 RSS，以避开浏览器 CORS 限制。

## Cloudflare Pages 部署

在 Cloudflare Pages 中连接仓库，并将项目的 **Root directory** 设置为 `rss-reader-static`：

- Framework preset：`None`
- Build command：留空
- Build output directory：`public`

Pages 会自动识别 `functions/api/rss.js`。也可以使用 Wrangler 部署：

```bash
cd rss-reader-static
npx wrangler pages deploy public --project-name mixed-rss-reader
```

## 本地开发

### 使用 Docker（推荐）

```bash
cd rss-reader-static
docker compose up --build -d
```

浏览器访问 `http://localhost:8788`。查看日志和停止服务：

```bash
docker compose logs -f rss-reader
docker compose down
```

订阅地址保存在浏览器中，因此重新构建或删除容器不会清除订阅地址。

### 使用 Node.js

```bash
cd rss-reader-static
npm install
npm run dev
```

访问终端输出的本地地址即可。直接双击 `public/index.html` 可以查看界面，但读取 RSS 需要 Pages Function，因此应使用 Wrangler 启动。

## 限制

- RSS 地址必须是 HTTPS。
- 单次响应最大 2 MB，最多跟随 4 次重定向。
- 地址数据按域名保存在当前浏览器，清理站点数据后会丢失。
- 需要 Cookie、登录或 Cloudflare 人机验证的 Feed 无法读取。
