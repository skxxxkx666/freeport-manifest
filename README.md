# 舱单 MANIFEST —— 项目结构

设计与视觉规格见 `freeport-manifest-design-prompt.md`。此处只记结构与约定。

```
src/
  pages/
    index.astro                 /                    首页
    today.astro                 /today               今日舱单
    archive/
      index.astro               /archive             存根索引(copy-blue)
      [date].astro              /archive/2026-07-27  单张存根,盖 EXPIRED 红章
    upgrade.astro               /upgrade             登机升舱(唯一大面积 port-blue)
    faq.astro                   /faq                 手风琴
    404.astro                   无此运单 NOT FOUND 红章
  components/
    Shell.astro                 齿孔边 + 纸纹噪点 + 导航 + 页脚
    WaybillHead.astro           运单号大字 + 套印错位 + 图章
    FieldGrid.astro             方格单元 + 左上角字段标签
    TearLine.astro              骑缝线(radial-gradient 打孔)
    Stamp.astro                 橡皮图章(圆形双线 + 飞机剪影 + 日期位)
    CompareTable.astro          免费联 vs 登机联
    PlanCards.astro             四档舱位
    islands/
      SubscriptionCard.tsx      client:load     换联 / 3 秒解锁 / 复制 / 盖章 / 二维码
      UpdateCountdown.tsx       client:idle     下次签发倒计时
      ArchiveFilter.tsx         client:visible  年月筛选(纯前端过滤,不走路由)
      FaqAccordion.tsx          client:visible  FAQ 展开
      CopyCode.tsx              client:visible  折扣码复制
  content.config.ts             Astro Content Layer + glob loader + Zod 4
  content/
    subs/2026-07-28.md          每日运单,由 Actions 生成
  lib/waybill.ts                运单号、路径、倒计时、深链
  styles/theme.css              @theme token 表
scripts/deployment-config.mjs   从仓库/环境变量推导 site + base
scripts/issue-manifest.mjs      拉取 → 解析/转换 → 生成订阅文件与 md
scripts/cloudflare-dns.mjs      Cloudflare DNS 幂等协调器
scripts/cloudflare-zone.mjs     Cloudflare 区域安全基线 plan/apply 管理器
scripts/*.test.mjs              Node Test Runner 工程测试
config/sources.json             默认公开来源与授权门控
.github/workflows/daily.yml     每日 cron 签发 + 构建 + 部署 Pages
public/free/YYYYMMDD/           每日 Clash / V2Ray 真实订阅产物
public/fonts/                   得意黑子集(≤ 50KB)
```

## 验证状态

2026-07-29 验证记录(只改后端/工程文件,未改前端布局或样式):

1. **已验证 — Astro 7.1 最新技术栈。**
   当前使用 Astro 7.1.5、Vite 8.1.5、React 19.2.8、TypeScript 6.0.3、
   Node 24 LTS 和 Astro Content Layer;生产依赖 `npm audit --omit=dev` 为 0 漏洞。
   本地与 GitHub Actions 的 Linux runner 均已通过 `npm ci`;`npm test`(22/22)、
   `npm run check`(0 error)和 `npm run build`(22 pages)均通过。
2. **已解决 — `site` / `base` 无占位值。**
   `scripts/deployment-config.mjs` 在 Actions 中读取 `GITHUB_REPOSITORY`,自动得到
   `https://<owner>.github.io` 与 `/<repository>`;用户/组织主页仓库自动使用 `/`。
   `SITE_URL`、`BASE_PATH` repository variables 可覆盖为自定义域名或特殊 Pages 地址。
   生产仓库已设置 `SITE_URL=https://manifest.dpdns.org`、`BASE_PATH=/`,并在
   GitHub Pages workflow 中完成根路径构建和首次部署。
3. **已解决 — 真实来源与订阅交付。**
   默认通过 GitHub Contents API 读取 `PuddinCat/BestClash` 的 Clash YAML;响应仍兼容明文 URI、
   base64/base64url、JSON API(含嵌套 base64)和 Clash YAML/JSON `proxies`。
   每次签发会实际写出 `public/free/YYYYMMDD/clash.yaml` 和 `v2ray.txt`,而不是只写
   两个占位 URL。Clash 文件保留 TUIC;V2Ray 文件只转换该订阅生态兼容的
   `vmess/vless/trojan/ss`。请求采用 45 秒超时并自动重试一次,单源失败不泄露请求头。
4. **部分验证 — 深链与 375 宽度。**
   Edge 375×812 实测:页面整体 `scrollWidth=375`,sticky 导航滚动 900px 后仍
   `top=0`;明细表容器 `331px`、内容 `420px`,可横向滚到 `89px`。
   导航会换成约 4 行且总高 `155px`,功能正常但占屏较高;截图见
   [`output/playwright/today-375.png`](output/playwright/today-375.png)。
   本机 `clash://` 已注册到 Clash Verge,生成的 URL 参数编码正确;
   `clashmeta://`、`sub://`、`shadowrocket://` 未注册,仍需装有对应客户端的
   Android/iOS 真机完成实际唤起与导入验证。
5. `src/content/subs/` 里 2026-05-29 ~ 2026-07-27 共 13 份是**示例存根**(`expired: true`),
   用来让 `/archive` 有内容可看。上线前删掉,或留着当回归样本。

## 已知未验证项

- GitHub Pages workflow 已首次部署成功;`manifest.dpdns.org` 目前仍缺少 DNS 记录,
  需要通过 Cloudflare API 写入 CNAME 后继续验证 DNS、Pages 证书与 HTTPS 强制跳转。
- V2Nodes 新加坡适配器已启用并进入真实抓取路径,但 2026-07-30 本地网络访问该站时
  被对端重置连接(`ECONNRESET`);需要由 GitHub Actions 再验证一次其服务器网络可达性。
- 375×812 已在桌面 Edge 仿真通过,但 sticky 导航仍需 iOS Safari / Android Chrome
  真机验证。
- `clash://` 已在 Windows Clash Verge 验证;`clashmeta://`、`sub://`、
  `shadowrocket://` 仍需安装对应客户端的手机真机验证。
- 生成文件已完成结构校验与 round-trip 测试,尚需在真实 Mihomo 与 V2Ray 客户端各导入
  一次并验证连通性。免费上游节点随时可能失效,构建成功不等于节点可用。

## 部署与来源配置

生产域名统一使用 `manifest.dpdns.org`;站点与订阅同源,订阅路径为
`/free/YYYYMMDD/clash.yaml` 和 `/free/YYYYMMDD/v2ray.txt`。仓库变量设置为:

```text
Repository variable SITE_URL=https://manifest.dpdns.org
Repository variable BASE_PATH=/
```

`manifest.dpdns.org` 本身是委派给 Cloudflare 的 zone apex。`public/CNAME` 已提交;
Cloudflare DNS 使用 CNAME flattening 指向 GitHub Pages。首次接入先保持 DNS only,
待 GitHub Pages 签发并启用 HTTPS 后再切换 Proxied,否则橙云可能阻断 GitHub 的首次
域名校验:

```text
@  CNAME  skxxxkx666.github.io  proxied=false  ttl=auto
```

Cloudflare 一律走 API,不使用控制台手工修改。原来的 `Zone Read` + `DNS Edit`
只能查询区域和修改 DNS,不足以配置 TLS 与安全基线。新版中文 Token 页面中把资源
范围设为“包括 → 特定区域 → `manifest.dpdns.org`”,至少授予以下四项:

```text
区域 → 区域 → 读取
区域 → DNS → 编辑
区域 → 区域设置 → 编辑
区域 → SSL 和证书 → 编辑
```

英文新版 API 文档可能把“编辑”显示为 `Write`,含义相同。若后续还要通过 API 管理
自定义 WAF、安全响应头或主动清缓存,再为同一个特定区域增加:

```text
区域 → 区域 WAF → 编辑
区域 → 转换规则 → 编辑
区域 → 缓存清除
```

Token 通过环境变量注入,不要写进仓库。编排器分三阶段执行:

```powershell
$env:CLOUDFLARE_API_TOKEN="<scoped-token>"

# 1. 只读计划并写入 DNS-only CNAME + 区域安全基线
npm run cloudflare:plan
npm run cloudflare:apply

# 2. GitHub Pages 证书生效并强制 HTTPS 后,切换橙云
npm run cloudflare:proxy:plan
npm run cloudflare:proxy:apply

# 3. HTTPS 稳定后最后启用 6 个月 HSTS,不含子域且不预加载
npm run cloudflare:hsts:plan
npm run cloudflare:hsts:apply
```

所有 `plan` 命令只读;所有 `apply` 命令幂等。若同名存在 A/AAAA 等冲突记录,脚本会
停止并要求人工判断,不会擅自删除。可选 `CLOUDFLARE_ZONE_ID` 用于跳过区域查询。
安全基线使用“SSL/TLS → 概述 → 完全（严格）”,并启用 Universal SSL、始终使用
HTTPS、最低 TLS 1.2、TLS 1.3、自动 HTTPS 重写、HTTP/2、HTTP/3 与 Brotli。
0-RTT、Rocket Loader、浏览器完整性检查和热链保护保持关闭:前两者分别避免重放与
Astro 脚本改写,后两者避免误伤 Clash/Mihomo/V2Ray 等非浏览器订阅客户端。
HSTS 不会在首轮应用时提前开启。

默认来源在 `config/sources.json`,不设置 secret 也能签发。`SUB_SOURCES` secret 用于追加
其他来源,仍可使用旧格式:

```text
https://public-one.example/sub https://public-two.example/sub
```

需要 API 鉴权时,把 `SUB_SOURCES` secret 保存为 JSON(请求头值本身也在 secret 内):

```json
{
  "sources": [
    "https://public.example/sub",
    {
      "url": "https://api.example/sub",
      "headers": {
        "Authorization": "Bearer <token>",
        "X-Api-Key": "<key>"
      }
    }
  ]
}
```

### 来源许可边界

- BestClash README 明确提供 `proxies.yaml` 作为免费订阅地址,但仓库当前没有声明
  SPDX/开源许可证;本项目保留来源标识,使用前仍应自行评估其上游节点许可与风险。
- V2Nodes 的国家页需要逐个访问详情页才能取得分享链接。适配器已经实现,但其服务条款
  写明仅限个人非商业使用,且未经书面许可不得复制或分发站点内容。当前已按站点运营者
  的明确指示为 `v2nodes-sg` 设置 `"enabled": true` 与
  `"allowRedistribution": true`;运营者仍需自行确认授权有效。若未获许可,应将任一
  开关设为 `false` 以停止抓取与再分发。

本地与 CI 的固定验证顺序:

```bash
npm ci
npm test
npm run check
npm run build
```

## 约定

- **不带 Tailwind**。§4 原文用的是 Tailwind v4 的 `@theme{}`,但全站是内联样式、零
  utility class,带一个 Tailwind 只会引入 v3/v4 语法版本陷阱。token 落在
  `styles/theme.css` 的 `:root` 里,名字与 §4 完全一致。
- **内部链接一律 `url()`**(`src/lib/waybill.ts`),它基于 `import.meta.env.BASE_URL`。不要写死 `/`,否则 `base` 一改全站链接失效。
- **岛只有五个**,列在上表。其余全部静态 `.astro`,不要为了省事把整页做成岛。
- **字体**:中文正文纯系统栈,不加载 webfont。得意黑只用于中文大标题,且必须子集化到 `public/fonts/smiley-sans-subset.woff2`,产物 ≤ 50KB。
- **二维码**在客户端用 `qrcode` 生成,不引任何第三方图片接口。
- **教程不在本站**。所有教程入口(导航、首页第 02/03 步、页脚)直接外链
  <https://wiki.freedomport.cc/>,带 `target="_blank" rel="noopener"`。这是公益站为
  FreedomPort 主站保留的教程/广告入口,不是本站部署域名;不要新建 `/tutorial` 路由。
- **可选字段判空后再渲染**:`breakdown` 没有就整块不渲染,不要显示空状态占位。

## 页面清单(已实现)

```
src/pages/index.astro            /                    首页
src/pages/today.astro            /today               今日舱单
src/pages/archive/index.astro    /archive             存根索引(copy-blue)
src/pages/archive/[date].astro   /archive/2026-07-27  单张存根,EXPIRED 红章
src/pages/upgrade.astro          /upgrade             登机升舱(唯一大面积 port-blue)
src/pages/faq.astro              /faq                 手风琴
src/pages/404.astro              无此运单 NOT FOUND 红章
```

组件:`Shell` `Stamp` `FieldGrid` `TearLine` `WaybillHead` `CompareTable` `PlanCards`
岛:`SubscriptionCard`(client:load) `UpdateCountdown`(client:idle) `ArchiveFilter` `FaqAccordion` `CopyCode`(client:visible)
数据:`lib/subs.ts`(collection 读取 + 校验位)、`lib/faq.ts`、`lib/waybill.ts`

**格线规则(踩过的坑,别改回去):** 所有方格单元用 `display:flex;flex-wrap:wrap` +
每格 `border-right` / `border-bottom`,容器只给 `border-top` / `border-left`。
**不要**用 `grid-template-columns:repeat(auto-fit,minmax(...))` 配 `gap:1px` + 容器底色 ——
列数由容器宽度决定,格子数填不满最后一行时,空出来的网格区域会露出容器底色,
形成一段没有格子的灰条,右侧与底部的格线永远合不上。flex-wrap 的每一行都被格子铺满。

## 子集化得意黑

**子集已生成:`public/fonts/smiley-sans-subset.ttf`,32.1KB / 213 字形,在 §5 的 50KB 预算内。**
生成方式:直接对 `SmileySans-Oblique.ttf`(glyf 轮廓格式)做表级子集 —— 重建
`glyf` / `loca` / `hmtx` / `cmap`(format 4)/ `maxp` / `hhea`,改写复合字形的组件
id,丢掉 `GSUB` `GPOS` `GDEF` `vhea` `vmtx`,`post` 降为 3.0 版(不带字形名)。
完整 woff2 是 1.10 MB —— 22 倍于预算,**不要**直接上生产。
它只用于中文大标题(h1 / h2 / 卡片标题 / 导航与页脚的「舱单」),正文与字段标签仍是系统栈。

站内标题实际用到 **101 个汉字**:

```
一上不个为久么些享什付以位体免入全准分到制办包升单可后吗和哪四在基复外多存安客导差常并底开往很怎慢或户打择持支放新无日时更有期机标根档次此每没流清港点版由登础站端者联自舱节行见订贸费运这连选量问阅限题验
```

若要更小的 woff2(Brotli 压缩后约 20KB),用 fontTools 重跑一次:

```bash
pip install fonttools brotli
pyftsubset SmileySans-Oblique.ttf \
  --text="一上不个为久么些享什付以位体免入全准分到制办包升单可后吗和哪四在基复外多存安客导差常并底开往很怎慢或户打择持支放新无日时更有期机标根档次此每没流清港点版由登础站端者联自舱节行见订贸费运这连选量问阅限题验" \
  --flavor=woff2 --layout-features='' --no-hinting --desubroutinize \
  --output-file=public/fonts/smiley-sans-subset.woff2
```

101 字的产物约 20–30KB,在预算内。改了标题文案就重跑一次;
产物超过 50KB 说明标题用字太散,**收敛文案而不是放宽预算**。

得到 woff2 后把 `theme.css` 的 `@font-face` 改成 woff2 优先、ttf 兜底即可。
设计稿(`舱单 MANIFEST.dc.html`)引的是同一份 ttf 子集。
