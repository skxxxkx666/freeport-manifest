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
    SubscriptionCard.astro      原生渐进增强:换联 / 3 秒解锁 / 复制 / 盖章 / 按需二维码
    UpdateCountdown.astro       原生下次签发倒计时
    ArchiveFilter.astro         原生年月筛选(无 JS 时仍显示全部)
    FaqList.astro               原生 details / summary
    CopyCode.astro              原生折扣码复制
  content.config.ts             Astro Content Layer + glob loader + Zod 4
  content/
    subs/2026-07-28.md          每日运单,由 Actions 生成
  lib/waybill.ts                运单号、路径、倒计时、深链
  styles/theme.css              @theme token 表
scripts/deployment-config.mjs   从仓库/环境变量推导 site + base
scripts/issue-manifest.mjs      拉取 → 解析/转换 → 生成订阅文件与 md
scripts/probe-nodes.mjs         用 Mihomo 做发布前连通性、延迟与小流量测速
scripts/check-seo.mjs           构建后逐页验证 SEO 元数据与 sitemap
scripts/measure-mobile.mjs      Playwright 实测窄屏布局(顶栏高/换行数/溢出/sticky)
scripts/indexnow.mjs            部署后通知 IndexNow 抓取核心页面
scripts/cloudflare-dns.mjs      Cloudflare DNS 幂等协调器
scripts/cloudflare-zone.mjs     Cloudflare 区域安全基线 plan/apply 管理器
scripts/*.test.mjs              Node Test Runner 工程测试
config/sources.json             默认公开来源与授权门控
.github/workflows/ci.yml        push / PR 测试、检查与构建
.github/workflows/daily.yml     每 12 小时拉取、实测、签发并提交
.github/workflows/deploy.yml    main 推送后独立部署 Pages + 可选 CF 清缓存
public/free/YYYYMMDD/           每次签发的 Clash / provider / V2Ray 历史快照
public/free/latest/             客户端长期订阅的滚动地址与脱敏健康报告
public/og-card.png              1200×630 搜索与社交分享预览图
public/fonts/                   得意黑子集(≤ 50KB)
```

## 验证状态

2026-07-31 验证记录:

1. **已验证 — Astro 7.1 最新技术栈。**
   当前使用 Astro 7.1.6、Vite 8.1.5、TypeScript 6.0.3、
   Node 24 LTS 和 Astro Content Layer;交互由 Astro 原生组件与小型 DOM 脚本实现,
   不再加载 React 运行时。生产依赖 `npm audit --omit=dev` 为 0 漏洞。
   本地已通过 `npm ci`;`npm test`(43/43)、
   `npm run check`(0 error)和 `npm run build`(23 pages)均通过。
   TypeScript 7.0.2 虽已发布,但 `@astrojs/check@0.9.10` 的 peer 范围仍只有
   `^5 || ^6`,所以暂不做不兼容升级。
2. **已解决 — `site` / `base` 无占位值。**
   `scripts/deployment-config.mjs` 在 Actions 中读取 `GITHUB_REPOSITORY`,自动得到
   `https://<owner>.github.io` 与 `/<repository>`;用户/组织主页仓库自动使用 `/`。
   `SITE_URL`、`BASE_PATH` repository variables 可覆盖为自定义域名或特殊 Pages 地址。
   生产仓库已设置 `SITE_URL=https://manifest.dpdns.org`、`BASE_PATH=/`,并在
   GitHub Pages workflow 中完成根路径构建和首次部署。
3. **已解决 — 真实来源、发布前实测与订阅交付。**
   默认读取 BestClash、V2Nodes 新加坡、`Au1rxx/free-vpn-subscriptions` 和
   `Barabama/FreeNodes`;后两个来源声明 MIT 许可并分别限制为 80/60 个候选。
   响应仍兼容明文 URI、base64/base64url、JSON API(含嵌套 base64)和 Clash YAML/JSON
   `proxies`。每次签发先由固定版本 Mihomo 对所有候选做两个 204 目标的连通性与延迟
   测试,再优先按协议分散选择候选,最多尝试 20 个节点,直到取得 12 个成功的 250 KB
   小流量下载样本。生成前拒绝内网、环回、链路本地、非法端口和带危险出站覆盖字段的
   节点。全局最多实测 200 个候选并发布 120 个,延迟超过 2500 ms 的节点不会进入产物。
   只有实测存活节点会进入 `clash.yaml`、`provider.yaml` 和 `v2ray.txt`;至少需要 10 个
   且候选存活率不低于 10%,否则整次签发失败并保留线上上一版。大型聚合源的低命中项
   只消耗测试预算,不会进入产物。`health.json` 记录来源
   状态、脱敏节点哈希、延迟、失败分类和测速结果。
   V2Ray 转换现已保留 `skip-cert-verify`、ALPN、SNI、fingerprint 等关键 TLS 字段;
   遇到自定义 WS header、SS plugin 等无法无损表达的 Clash 配置时跳过该 V2 链接,
   不再发布表面可导入但实际失真的链接。
4. **已验证 — 当前订阅连通性与小流量测速。**
   2026-07-31 云端签发从 169 个去重候选筛出并发布 81 个 Clash 节点、
   76 个 V2Ray 节点,候选存活率 47.9%,延迟中位数 169 ms、P95 278 ms;
   12 个节点完成 250 KB 下载样本,完整 `clash.yaml` 已通过 Mihomo 配置测试。
   该数据只证明测试时刻和 GitHub Actions 测试网络可用,不是带宽承诺。
   后续结果以 `public/free/latest/health.json` 为准。
5. **已解决 — 窄屏布局。部分验证 — 深链。**
   顶栏在 ≤640px 拆成品牌行 + 导航行,导航单行不换行、路径码隐藏、每项
   `min-height:44px`;明细表 `min-width` 从与数据无关的 `420px` 收到 `260px`
   (breakdown 实际最长值 `OTHER` / `trojan`,自然内容宽约 210px)。

   `node scripts/measure-mobile.mjs` 对生产构建的 Chromium 实测(2026-07-30):

   | 视口 | 顶栏高 | 导航行数 | 触摸目标 | 页面横向溢出 | 明细表溢出 | 滚动 900px 后 sticky |
   |---|---|---|---|---|---|---|
   | 375×812 | `89px` | 1 | `44px` | 无 | 无(331/331) | `top=0` |
   | 320×568 | `89px` | 1 | `44px` | 无 | 无(276/276) | `top=0` |
   | 1280×900 | `48px` | 1 | `36px` | 无 | 无 | `top=0` |

   顶栏由 `155px` 降到 `89px`。320px 下导航仍会横向滚 18px,这是刻意保留的兜底,
   末项被裁切正好提示可滑动。截图见
   [`output/playwright/today-375.png`](output/playwright/today-375.png)。

   宽屏实测(2026-07-31,单据改流体宽度 + Hero 栅格后):

   | 视口 | 单据宽 | 占屏 | 单侧桌面 | h1 | 运单号 | 对照表溢出 |
   |---|---|---|---|---|---|---|
   | 1280 | `1178px` | 92% | 51px | 33px | 49px | 无 |
   | 1440 | `1325px` | 92% | 58px | 37px | 56px | 无 |
   | 1920 | `1400px` | 73% | 260px | 38px | 56px | 无 |

   改前恒为 `1120px`:1920 下只占 58%、两侧各 400px,且 1280 以上字号完全不再变化。
   Hero 改成 `minmax(0,1fr) minmax(180px,auto)` 栅格、图章靠右贴边,正文与图章之间的
   空洞由约 400px 降到 80px。两联对照表在 `≤640px` 改为按行拆卡,375 下由横滚 209px
   变为零溢出。明细表在桌面把连续两条记录排成六列并用满内容宽度,让放宽后的
   单据承载更多信息;`<768px` 回到原始三列表,保持逐条阅读和零横向溢出。

   **字号只小幅上调,不随容器等比放大。** 中途曾把运单号推到 72px、h1 推到 48px,
   结果是把稀疏的版面放大而非填满,反而更难看 —— 已回退。宽度多出来时正确的用法是
   装更多信息:首页概况栏由 4 格补到 6 格(新增实测存活率与校验位)并入运单抬头,
   不再单占一条全宽横带。判据写在 DESIGN.md 的 The Dense Sheet Rule。
   仍需 iOS Safari / Android Chrome 真机复核 —— Chromium headless 不覆盖
   Safari 的 sticky 与 `env(safe-area-inset-*)` 行为。

   本机 `clash://` 已注册到 Clash Verge,生成的 URL 参数编码正确;
   `clashmeta://`、`sub://`、`shadowrocket://` 未注册,仍需装有对应客户端的
   Android/iOS 真机完成实际唤起与导入验证。
6. **已验证 — 生产域名与 Cloudflare 安全基线。**
   `manifest.dpdns.org` 已通过 GitHub Pages 签发自定义域名证书并强制 HTTPS;
   Cloudflare CNAME 已切换 Proxied。实际请求已验证 HTTP 301、HTTPS 200、TLS 1.3、
   `X-Content-Type-Options: nosniff`，首页、今日页及两种订阅文件均为 200。
   区域使用完全（严格）、最低 TLS 1.2、6 个月 HSTS（不含子域、不预加载）和
   Cloudflare Managed Free Ruleset。按主机清除缓存的 API 权限也已实测成功，
   最终 `cloudflare:hsts:plan` 全部为 `unchanged`。
7. **已解决 — 历史状态与统计完整性。**
   每次签发会自动把早于当天的真实运单标成 `expired: true`;区域统计不再丢弃
   `OTHER`,因此 `breakdown` 合计与 `nodeCount` 一致。来源部分失败会以
   `partial/failed` 写进脱敏健康报告和运单备注,不再静默降级。
8. `src/content/subs/` 里 2026-05-29 ~ 2026-07-27 共 13 份是**示例存根**(`expired: true`),
   用来让 `/archive` 有内容可看。上线前删掉,或留着当回归样本。
9. **已验证 — 新前端对齐、渐进增强与打印。**
   1503px 视口下顶栏与单据左右边界误差小于 `0.02px`,品牌与首页 H1 的内容边线
   误差同样小于 `0.02px`;375px 下无页面横向溢出,导航保持单行、44px 触摸目标和
   sticky `top=0`。`/today` 首次只请求 `5234B` 交互脚本,二维码库 `23515B`
   仅在用户点开二维码后加载;改造前该页首次加载约 `217KB` JavaScript。
   `/archive` 与 `/upgrade` 不再加载 React 运行时。复制、换联、二维码、月份筛选、
   3 秒放行帘和无 JavaScript 内容回退均通过 Playwright 实测。全站已加入打印样式,
   打印时隐藏 sticky 导航和纸纹,并展开 FAQ 答案;页面标题层级补齐为真实 H2。
   签发时间统一按 `Asia/Shanghai` 格式化,不再把 UTC 时间误标成 UTC+8。

## 已知未验证项

- DNSSEC 当前保持关闭。`manifest.dpdns.org` 是子区，而父区 `dpdns.org` 目前未发布
  DNSSEC 委派；建立完整信任链需要父区运营方先启用 DNSSEC，并写入 Cloudflare
  为子区生成的 DS。仅用本区域 Token 单边开启不能完成端到端 DNSSEC。
- 375×812 / 320×568 已用 Playwright + Chromium 对生产构建实测通过(数据见验证状态 §5),
  但 sticky 顶栏与安全区仍需 iOS Safari / Android Chrome 真机复核。
- Hero 栅格、单据流体宽度与对照表拆卡是 2026-07-31 的改动,仅在 Chromium 实测。
  `word-break: auto-phrase`(步骤卡中文断词)目前只有 Chromium 系支持,Safari 与
  Firefox 会静默忽略并退回默认断行 —— 属渐进增强,不影响可读性。
- `clash://` 已在 Windows Clash Verge 验证;`clashmeta://`、`sub://`、
  `shadowrocket://` 仍需安装对应客户端的手机真机验证。
- Clash 订阅已在官方 Mihomo 1.19.29 完成真实加载、连通性、延迟和下载采样;
  V2Ray 文本已通过转换 round-trip 测试,但仍需在真实 V2Ray/Shadowrocket 客户端导入一次。
- V2Nodes 条款所需的复制/再分发许可仍需运营者自行留存书面证据。代码中的
  `allowRedistribution: true` 只是技术开关,不构成授权。
- 曾在对话中公开过的 Cloudflare Token 必须视为已泄露并撤销。创建替代 Token 后,
  还需将它保存为仓库 Secret `CLOUDFLARE_API_TOKEN`,部署工作流才会自动清缓存。
- Cloudflare 清除的是本 zone 的缓存;GitHub Pages/Fastly 当前给静态文件约
  `max-age=600`,无法用 Cloudflare Token 主动清除该上游缓存,同日重签最多可能延迟约
  10 分钟可见。

## 部署与来源配置

生产域名统一使用 `manifest.dpdns.org`;站点与订阅同源。客户端应长期使用:

```text
https://manifest.dpdns.org/free/latest/clash.yaml
https://manifest.dpdns.org/free/latest/provider.yaml
https://manifest.dpdns.org/free/latest/v2ray.txt
https://manifest.dpdns.org/free/latest/health.json
```

`provider.yaml` 只包含节点,适合已有自定义规则的 Mihomo 用户;`clash.yaml` 是完整配置。
`/free/YYYYMMDD/` 只作历史快照,不应作为客户端长期订阅地址。仓库变量设置为:

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
区域 → 清除缓存 → 清除
```

Token 通过环境变量注入,不要写进仓库。编排器分三阶段执行:

```powershell
$env:CLOUDFLARE_API_TOKEN="<scoped-token>"

# 1. 只读计划并写入 DNS-only CNAME + 区域安全基线
npm run cloudflare:plan
npm run cloudflare:apply

# 2. GitHub Pages 证书生效并强制 HTTPS 后,切换橙云并部署免费托管 WAF
npm run cloudflare:proxy:plan
npm run cloudflare:proxy:apply

# 3. HTTPS 稳定后最后启用 6 个月 HSTS,不含子域且不预加载
npm run cloudflare:hsts:plan
npm run cloudflare:hsts:apply

# 按主机清除 manifest.dpdns.org 的 Cloudflare 缓存,并保留已启用的 HSTS
npm run cloudflare:purge
```

所有 `plan` 命令只读;所有 `apply` 命令幂等。若同名存在 A/AAAA 等冲突记录,脚本会
停止并要求人工判断,不会擅自删除。可选 `CLOUDFLARE_ZONE_ID` 用于跳过区域查询。
安全基线使用“SSL/TLS → 概述 → 完全（严格）”,并启用 Universal SSL、始终使用
HTTPS、最低 TLS 1.2、TLS 1.3、自动 HTTPS 重写、HTTP/2、HTTP/3 与 Brotli。
0-RTT、Rocket Loader、浏览器完整性检查和热链保护保持关闭:前两者分别避免重放与
Astro 脚本改写,后两者避免误伤 Clash/Mihomo/V2Ray 等非浏览器订阅客户端。
HSTS 不会在首轮应用时提前开启。WAF 使用所有套餐均可用的
Cloudflare Managed Free Ruleset 默认动作，不增加浏览器质询。

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

所有来源只接受 HTTPS(测试 fixture 可用 `data:`),响应上限 5 MB。`maxItems` 同时限制
Clash 对象和分享链接的总数,防止大型聚合源拖垮 Runner 与客户端。生成器手动处理最多
5 次重定向;带自定义鉴权 header 的来源禁止跨源重定向,避免凭据被转发到其他主机。
单个来源失败不会泄露 header,只在健康报告中公开来源 ID、状态和条目数。

定时签发、持续集成和部署彼此独立。GitHub Actions 每天北京时间 04:17 和 16:17
自动运行,不依赖本地电脑开机:

- `daily.yml` 每 12 小时或手动触发时下载经过 SHA-256 校验的 Mihomo 1.19.29,
  拉取来源、实测节点并提交新产物;提交后显式触发 CI 与部署,避免 GitHub 内置
  `GITHUB_TOKEN` 的防递归规则让机器人 push 被普通工作流忽略。
- `ci.yml` 在每个 push/PR 执行测试、Astro 检查和完整构建。
- `deploy.yml` 在 `main` 推送后构建并部署当次精确提交;若仓库存在新的
  `CLOUDFLARE_API_TOKEN` Secret,部署成功后按主机清除 Cloudflare 缓存。

三条工作流均有超时、最小权限和并发保护,第三方 Action 固定到已核验 commit SHA。

## 搜索引擎优化

生产构建会自动生成 `sitemap-index.xml` 与 `sitemap-0.xml`,并在 `robots.txt` 和每页
`<head>` 中声明 sitemap。首页、今日订阅、往期索引、FAQ、升舱页允许索引;
404 与按日期生成的失效存根使用 `noindex,follow` 并从 sitemap 排除,避免大量相似页面
稀释有效内容。`/free/` 下的原始订阅文件在 robots 中禁止抓取。

每个可索引页面都有独立的 title、description、canonical、Open Graph、Twitter Card
和 JSON-LD。首页正文与 FAQ 自然覆盖“免费 Clash 订阅”“Mihomo 节点”“V2Ray 订阅”
“v2rayN”“Shadowrocket”“Clash Verge”等真实查询词,不使用无效的 `meta keywords`
或关键词堆砌。部署成功后会通过 IndexNow 主动通知 Bing 等参与搜索引擎。

构建后执行:

```bash
npm run seo:check
```

脚本会检查元数据唯一性、canonical 与 `og:url` 一致性、JSON-LD、索引规则、核心语义
和 sitemap 内容。Google 仍需站长在 Search Console 验证域名并提交
`https://manifest.dpdns.org/sitemap-index.xml`;技术配置只能确保可发现和可抓取,
不能保证具体关键词排名或收录时间。

### 来源许可边界

- BestClash README 明确提供 `proxies.yaml` 作为免费订阅地址,但仓库当前没有声明
  SPDX/开源许可证;本项目保留来源标识,使用前仍应自行评估其上游节点许可与风险。
- V2Nodes 的国家页需要逐个访问详情页才能取得分享链接。适配器已经实现,但其服务条款
  写明仅限个人非商业使用,且未经书面许可不得复制或分发站点内容。当前已按站点运营者
  的明确指示为 `v2nodes-sg` 设置 `"enabled": true` 与
  `"allowRedistribution": true`;运营者仍需自行确认授权有效。若未获许可,应将任一
  开关设为 `false` 以停止抓取与再分发。
- `Au1rxx/free-vpn-subscriptions` 与 `Barabama/FreeNodes` 仓库均声明 MIT 许可;
  本项目保留来源 ID、条目数和许可标识,并对其产物再次做独立 Mihomo 实测。
- 完整 Clash 配置通过 HTTP RULE-SET 引用 GPL-3.0 的
  `Loyalsoldier/clash-rules`,不复制或修改其规则文件;配置采用该项目推荐的白名单顺序:
  应用/私网/中国大陆直连、广告拒绝、代理域名与 Telegram 走代理、其余默认代理。

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
`SubscriptionCard` `UpdateCountdown` `ArchiveFilter` `FaqList` `CopyCode`
（全部为 Astro / 原生渐进增强,无 React hydration）
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
