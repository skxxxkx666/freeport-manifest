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
   `npm test`(10/10)、`npm run check`(0 error)和 `npm run build`(20 pages)均通过。
2. **已解决 — `site` / `base` 无占位值。**
   `scripts/deployment-config.mjs` 在 Actions 中读取 `GITHUB_REPOSITORY`,自动得到
   `https://<owner>.github.io` 与 `/<repository>`;用户/组织主页仓库自动使用 `/`。
   `SITE_URL`、`BASE_PATH` repository variables 可覆盖为自定义域名或特殊 Pages 地址。
   已用 `FreedomPort/freeport-manifest` 构建并确认所有内部资源/链接带
   `/freeport-manifest/` 前缀。
3. **已解决 — 真实来源与订阅交付。**
   默认从 `PuddinCat/BestClash` 的 raw YAML 拉取;响应仍兼容明文 URI、
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

- GitHub Pages 首次部署、`manifest.freedomport.cc` DNS 与 TLS 证书需要在仓库推送后做
  线上闭环验证。
- 375×812 已在桌面 Edge 仿真通过,但 sticky 导航仍需 iOS Safari / Android Chrome
  真机验证。
- `clash://` 已在 Windows Clash Verge 验证;`clashmeta://`、`sub://`、
  `shadowrocket://` 仍需安装对应客户端的手机真机验证。
- 生成文件已完成结构校验与 round-trip 测试,尚需在真实 Mihomo 与 V2Ray 客户端各导入
  一次并验证连通性。免费上游节点随时可能失效,构建成功不等于节点可用。

## 部署与来源配置

生产域名统一使用 `manifest.freedomport.cc`;站点与订阅同源,订阅路径为
`/free/YYYYMMDD/clash.yaml` 和 `/free/YYYYMMDD/v2ray.txt`。仓库变量设置为:

```text
Repository variable SITE_URL=https://manifest.freedomport.cc
Repository variable BASE_PATH=/
```

`public/CNAME` 已提交。Cloudflare DNS 还需要添加 DNS-only CNAME:

```text
manifest -> skxxxkx666.github.io
```

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
  写明仅限个人非商业使用,且未经书面许可不得复制或分发站点内容,因此
  `v2nodes-sg` 默认 `enabled: false`。只有取得书面授权后才可同时设置
  `"enabled": true` 和 `"allowRedistribution": true`;不要仅为绕过门控而开启。

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
- **教程不在本站**。所有教程入口(导航、首页第 02/03 步、页脚)直接外链 <https://wiki.freedomport.cc/>,带 `target="_blank" rel="noopener"`。不要新建 `/tutorial` 路由。
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
