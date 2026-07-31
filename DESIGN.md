---
name: 舱单 MANIFEST
description: 每日签发的多联复写纸舱单，节点经查验放行才印上去
colors:
  stamp-violet: "#7B3F9D"
  void-red: "#B8342C"
  void-ground: "#F3E4E3"
  port-blue: "#1258D8"
  port-blue-deep: "#0B3A93"
  port-blue-faint: "#5A7FC4"
  misprint-teal: "#2C6E7A"
  ink: "#2A2333"
  ink-soft: "#6B6478"
  ink-faint: "#A9A3B2"
  rule-grey: "#C9C2CE"
  rule-soft: "#E2DEE5"
  desk-manila: "#EDEAE3"
  original-copy: "#FBFAF7"
  green-ply: "#E2EDE0"
  pink-ply: "#F6E3E4"
  blue-ply: "#DEE7F1"
  blue-ply-deep: "#D3DEEC"
  buff-ply: "#F2E7CE"
  disabled-ground: "#E6E3DE"
  ledger-band: "#F1EFE9"
  notice-ground: "#F6F4EF"
  clearance-veil: "#F3F1EC"
typography:
  display:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "clamp(26px, 2.8cqw, 38px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.04em"
  wordmark:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  wordmark-sm:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  waybill-no:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(28px, 4.2cqw, 56px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  stamp-display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(28px, 5cqw, 44px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.12em"
  code-display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(21px, 3.2cqw, 29px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.1em"
  heading:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  numeral:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
  data-lg:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.03em"
  question:
    fontFamily: "Smiley Sans, Archivo Narrow, PingFang SC, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  body:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, Source Han Sans SC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
  stamp-sub:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(11px, 1.5cqw, 14px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.3em"
  body-sm:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, Source Han Sans SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  field-value:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  action-lg:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  action:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  control:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  nav:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  micro:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "0.1em"
  label-lg:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.14em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "9.5px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  none: "0"
spacing:
  hairline: "1px"
  xs: "5px"
  sm: "9px"
  md: "12px"
  lg: "20px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.original-copy}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "11px 18px"
  button-port:
    backgroundColor: "{colors.port-blue}"
    textColor: "{colors.original-copy}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-port-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.port-blue}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  ply-tab-active:
    backgroundColor: "{colors.green-ply}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  ply-tab-idle:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  field-cell:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.field-value}"
    rounded: "{rounded.none}"
    padding: "9px 11px 11px"
  stamp-cleared:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-violet}"
    rounded: "{rounded.none}"
    padding: "7px 14px 6px"
---

# Design System: 舱单 MANIFEST

## Overview

**Creative North Star: "放行柜台 / The Clearance Desk"**

这不是一个展示节点的网站，是一张**在柜台上被查验、盖章、然后放行的单据**。每天签发一张，每张都有运单号和校验位，每个节点都是先通过查验才被印上去的件数。用户看到的不是"我们提供了什么"，而是"什么已经被放行了"。

北极星决定了装置的排序：**校验位、图章、放行状态是第一层，分联底色是第二层，纸的物质性是第三层。**复制成功时那一下盖章不是"好看的动画"，它是这套系统里唯一的仪式，也是产品主张（实测存活才发布）在界面上的同构物 —— 查验通过，才有章。3 秒的放行遮罩同理：它不是防薅的技术遮羞布，它是柜台后面正在发生的查验过程。

气质是**精确，但带一点仪式感**。绝大多数时候这套系统安静、克制、行政性 —— 单据不讨好人，不卖萌，不用感叹号，美感全部来自准确本身。仪式只在两处允许出现：盖章的那一瞬，和撕联的那条骑缝线。除此之外一切保持单据的冷静。

**Key Characteristics:**

- 零圆角、零阴影，全局写死在 `*` 选择器上 —— 这是身份，不是默认值
- 1px 实线格线是唯一的分隔手段，不用发丝线、不用留白代替线
- 五种复写纸底色承担信息分区，颜色即语义（绿联 = Clash，粉联 = V2Ray，蓝联 = 归档）
- 全大写 Mono 字段标签 + 中英双语，每个数据点都有栏位名
- 章紫是签发与放行的唯一颜色；官方蓝只在升舱区出现，是跨品牌信号
- 套印错位（1.5px 位移的墨绿影层）只用在运单号与主标题上

## Colors

调色板是一叠复写纸放在牛皮纸柜台上，加两种印章油墨和一种外来的官方蓝。所有底色都是低饱和的暖灰系纸张，所有前景色都是"墨"。

### Primary

- **章紫 Stamp Violet** (`#7B3F9D`)：签发与放行的唯一颜色。图章双线圆环、飞机剪影、「已放行 CLEARED」章、放行倒计时、链接 hover、焦点环。它出现即意味着"这件事已经被系统确认过"。
- **柜台米 Desk Manila** (`#EDEAE3`)：单据之外的世界 —— 页面最底层的桌面。它把 1120px 的正本联衬托成一张真的纸。也是齿孔边打孔与骑缝线半圆缺口的填充色。

> ⚠️ 柜台米当前**没有**定义为 CSS 变量，6 处全是硬编码。见 Do's and Don'ts。

### Secondary

- **官方蓝 Port Blue** (`#1258D8`)：自由港的品牌色，**是跨品牌信号而不是本站强调色**。只允许出现在升舱区、导航「升舱」项、套餐价格与登机联列。在免费联的任何位置使用它都会破坏品牌区隔。
- **官方蓝深 Port Blue Deep** (`#0B3A93`)：对照表里登机联列的正文墨色，比 Port Blue 更沉，用于长文本可读性。
- **官方蓝淡 Port Blue Faint** (`#5A7FC4`)：升舱导航项的路径码颜色。它是官方蓝体系里的次级文字色，作用等同于次墨之于主墨 —— **只在已经是官方蓝的元素内部使用**，不得单独出现。

### Tertiary

- **作废红 Void Red** (`#B8342C`)：只有两个用途 —— 「已失效」与「无此运单」。**红色在这套系统里等于"这张单子不能用了"**，不表示错误、警告或强调。
- **作废红衬底 Void Ground** (`#F3E4E3`)：存根页失效通知条的底色，作废红的纸张对应物。
- **套印墨绿 Misprint Teal** (`#2C6E7A`)：套印错位的影层色，永远以 `opacity:.18` + `translate(1.5px,1.5px)` 出现在运单号和主标题背后。它模拟的是双色印刷没对准。**它永远不作为实色出现。**

> ⚠️ 套印墨绿同样**没有**定义为 CSS 变量，4 处硬编码。

### Neutral

**纸张（底色，由浅到深）**

- **正本联 Original Copy** (`#FBFAF7`)：单据本体的底，也是主内容区、导航栏、订阅链接框的底
- **绿联 Green Ply** (`#E2EDE0`)：Clash 订阅区
- **粉联 Pink Ply** (`#F6E3E4`)：V2Ray 订阅区
- **蓝联 Blue Ply** (`#DEE7F1`)：归档与存根区
- **蓝联深 Blue Ply Deep** (`#D3DEEC`)：存根索引里的月份分组带，蓝联深一档，用来在同色区内分层
- **黄联 Buff Ply** (`#F2E7CE`)：已声明但未使用，预留给教程联（当前教程外链至 wiki）
- **账带 Ledger Band** (`#F1EFE9`)：页脚、表头、换联控制条 —— 单据上的功能带，比正本联略深一档
- **通知底 Notice Ground** (`#F6F4EF`)：首页免责声明条的底
- **放行帘 Clearance Veil** (`#F3F1EC`)：3 秒放行遮罩的不透明底
- **失效底 Disabled Ground** (`#E6E3DE`)：存根页已失效按钮的底色。比柜台米更灰更沉，配淡墨文字表示「这个控件已经不能用了」

**油墨（前景，由深到浅）**

- **主墨 Ink** (`#2A2333`)：紫黑主墨。正文、字段值、主按钮底
- **次墨 Ink Soft** (`#6B6478`)：页脚免责声明、正文次级文字、说明性句子。**法律与正文内容必须落在这一级**
- **淡墨 Ink Faint** (`#A9A3B2`)：10–11px Mono 全大写字段标签、表头、辅助计数、虚线骑缝线

**格线**

- **格线 Rule Grey** (`#C9C2CE`)：结构线。全站最高频颜色（85 处），1px 实线
- **软格线 Rule Soft** (`#E2DEE5`)：表格行内分隔，比 Rule Grey 更轻一档

### Named Rules

**The Two Inks Rule.** 这套系统只有两种印章油墨：章紫和作废红。章紫说"这件事成立了"，作废红说"这张单子作废了"。**不得引入第三种状态色** —— 没有绿色的成功、没有黄色的警告、没有橙色的提示。状态靠文字和图章说，不靠色相扩容。

**The Foreign Blue Rule.** 官方蓝是外来色，不属于舱单。它每出现一次都在说"你正在离开这个品牌"。因此它只允许出现在升舱路径上，且必须整块出现（整个按钮、整列表格），不做小面积点缀 —— 点缀会让它退化成本站的强调色，品牌区隔随之消失。

**The Faint Label Rule.** 淡墨 (`#A9A3B2`) 在浅底上约 2.9:1，不满足 4.5:1。**这是已裁决的接受项**，适用范围严格限定为 10–11px Mono 全大写字段标签、表头与辅助计数。凡是法律文本、正文次级文字、说明性句子，一律用次墨 (`#6B6478`)。审计可以报告这一条，但不得据此回改字段标签。

## Typography

**Display Font:** Smiley Sans 得意黑，单一字重（回退 Archivo Narrow → PingFang SC，见下方投递说明）
**Body Font:** PingFang SC（回退 HarmonyOS Sans SC → Microsoft YaHei → Source Han Sans SC）
**Label/Mono Font:** IBM Plex Mono（回退 ui-monospace）

**Character:** 三族分工极清晰，各自只做一件事。得意黑只在中文大标题和字标上出现 —— 它的倾斜与紧结构提供了整套系统里唯一的"表情"，因此必须稀有。IBM Plex Mono 承担全部单据语言：字段标签、字段值、编号、按钮、导航、页脚，它的等宽让数据成列对齐，像真的打印在栏位里。系统中文体只做正文段落，无个性是它的职责。

### 字体投递与实测事实

**得意黑是单一字重的显示体。** 它没有 600/700 可用。`@font-face` 必须声明 `font-weight: 100 900`，否则浏览器会对 CSS 里的 600/700 合成假粗体 —— Chromium 是**原地加粗**（字宽完全不变，实测 h1 两种情况均为 574px），笔画撑进固定字身框，「港」「清」「单」这类密集字的字腔直接糊死。**后果：得意黑的 600 与 700 在视觉上完全相同，层级由字号与大小写承担，不由字重。**

**子集覆盖（实测 cmap，共 212 码点）：** 101 个汉字 + **全部 52 个拉丁字母** + **全部 10 个数字** + 标点。

> ⚠️ 只有 101 个汉字。**任何新增的中文大标题文案都必须先确认字形在子集内**，否则会静默回退到系统体，视觉上表现为"这一句标题突然不是同一个字体了"。拉丁与数字不必担心，已全覆盖。

**Archivo Narrow 不再下载。** 它只是得意黑的回退，而子集已覆盖全部拉丁与数字，因此**一个字形都不会渲染**。字体名保留在 `font-family` 栈里（本机装了就用，不装也不产生请求），但已从 Google Fonts 请求中移除。

**外部字重从 7 个降到 2 个：** 只请求 `IBM+Plex+Mono:wght@400;600`。此前请求 Archivo Narrow 的 400/500/600/700（全部无用）与 Plex Mono 的 400/500/600，其中 Plex Mono 500 全站仅 2 处表头使用，已并入 400。

**斜杠零不可用。** Google Fonts 的 IBM Plex Mono woff2 没有暴露 `zero` 特性，实测开关渲染完全一致。站内满是编号与校验位，本来适合用它区分 0/O —— 但它不存在，不要加无效声明。

**字体一律走 token，不许内联重写字体栈。** 用 `var(--font-display)` / `var(--font-mono)` / `var(--font-cn)`，永远不要把字体栈字面量抄进内联样式。

这不是洁癖。此前 124 处内联栈把 display 写成 `'Smiley Sans','Archivo Narrow','PingFang SC',sans-serif`，比 token 少了三级中文回退 —— **Windows 与 Android 上没有 PingFang SC，标题直接掉到通用 `sans-serif`**，而得意黑子集只有 101 个汉字，子集外的字全部渲染在错误的回退上。Mono 同样漏了 `ui-monospace`。一个栈抄 124 遍，改一次要改 124 处，漏一处就是一个只在别人机器上出现的 bug。

**颜色同理，且已清理完毕。** `:root` 补齐了 10 个此前只在本文档有名字、却从未进入代码的 token（`--color-desk`、`--color-band`、`--color-notice`、`--color-veil`、`--color-rule-soft`、`--color-misprint`、`--color-void-bg`、`--color-copy-blue-d`、`--color-disabled`、`--color-port-blue-f`），272 处内联字面量已换成 `var()`。实测全站渲染出 19 种颜色，**全部落在调色板内，零野色，零未解析**。

**三处必须保持字面量，不要「顺手」改掉：**

| 位置 | 原因 |
|---|---|
| SVG 的 `fill=` / `stroke=` 呈现属性（图章，7 处） | `var()` 在呈现属性里支持不一致 |
| `<meta name="theme-color" content="#FBFAF7">` | meta 的 `content` 不经过 CSS，变量无效 |
| `QRCode.toCanvas` 的 `{ dark, light }` | canvas API 解析不了 CSS 变量，改了二维码直接画不出来 |

> **命名口径分裂（已知，不修）：** `theme.css` 的变量名沿用设计文档 §4（`--color-copy-white`、`--color-stamp`…），本文档前置元数据用描述性键名（`original-copy`、`stamp-violet`…）。CLAUDE.md 规定 §4 的 token 名是钉死的，所以两套名字长期并存。改代码时以 `theme.css` 为准，读规格时以本文档为准。

### Hierarchy

**流体级（随单据容器缩放，全部用 `cqw` 而非 `vw`）**

- **Waybill No.** (Mono 600, `clamp(28px, 7cqw, 56px)`, 1.0, `-0.02em`)：运单号。**全站唯一使用负字距的角色** —— 编号要挤成一个整体块，像打印机连续打出来的。首页、今日、存根一律同值
- **Display** (得意黑 700, `clamp(26px, 4.6cqw, 38px)`, 1.05, `+0.04em`)：页面 h1。带套印错位影层。**所有页面同值，首页不例外**
- **Stamp Display** (Mono 600, `clamp(28px, 5cqw, 44px)`, 1.05, `+0.12em`)：红图章大字「无此运单」「已失效」。作废红，`border: 4px double` 内
- **Code Display** (Mono 600, `clamp(21px, 3.2cqw, 29px)`, 1.1, `+0.1em`)：折扣码。章紫，双线框内
- **Stamp Sub** (Mono 400, `clamp(11px, 1.5cqw, 14px)`, `+0.3em`)：图章英文副行 `NOT FOUND` / `EXPIRED`

**固定级**

| 角色 | 字族 | 字号 | 字重 | 字距 | 用途 |
|---|---|---|---|---|---|
| **Heading** | 得意黑 | 23px | 700 | `+0.04em` | 区块 h2 |
| **Numeral** | Mono | 26px | 600 | — | 步骤序号、套餐价格 |
| **Wordmark** | 得意黑 | 21px | 700 | `+0.06em` | 顶栏字标「舱单」 |
| **Data LG** | Mono | 19px | 400 | `-0.01em` | 首页概况的大数值 |
| **Headline** | 得意黑 | 18px | 600 | `+0.03em` | 套餐名、步骤标题 |
| **Wordmark SM** | 得意黑 | 17px | 700 | `+0.06em` | 页脚字标 |
| **Question** | 得意黑 | 16px | 600 | `+0.02em` | FAQ 问题行 |
| **Body** | 系统中文 | 15px | 400 | — | 正文段落，`max-width: 40em` |
| **Body SM** | 系统中文 | 14px | 400 | — | 次级说明段落 |
| **Field Value / Action LG** | Mono | 13px | 400 | — / `+0.1em` | 字段值、表格正文 / 页面级 CTA |
| **Action** | Mono | 12.5px | 400 | `+0.1em` | 卡内按钮 |
| **Control** | Mono | 12px | 400 | `+0.1em` | 换联标签、放行状态、通知条 |
| **Nav** | Mono | 11px | 400 | `+0.1em` | 导航项 |
| **Micro** | Mono | 10.5px | 400 | `+0.1em` | 页脚链接、注记、免责声明、骑缝线说明 |
| **Label LG** | Mono | 10px | 400 | `+0.14em` | 区块字段标签（全站最高频） |
| **Label** | Mono | 9.5px | 400 | `+0.12em` | 单元格字段标签、表头 |

### Named Rules

**The Bilingual Label Rule.** 每个字段标签都是 `ENGLISH / 中文` 的形式（`CARRIER / 承运方`、`PIECES / 件数`、`CHECK / 校验位`）。英文在前是因为它承担国际货运单据的形式感，中文在后承担实际可读性。**新增字段必须遵守这个格式**，只写单一语言会立刻显得不属于这套系统。

**The Rare Display Rule.** `display` 级得意黑（页面 h1）每页只有一个。`heading` 级（23px 区块 h2）可以出现，但要克制 —— 它是版面的第二层锚点，不是每个区块都配。页面出现三个以上得意黑标题，稀有性消失，整套系统会从"单据"滑向"营销页"。

字号不承担全部层级：区块的重量也可以来自内容本身（56px 运单号、26px 章紫序号、图章），有强内容锚点的区块不必再加 h2。

**The Letterspacing Ladder Rule.** 字号越小，字距越大：56px 运单号 `-0.02em`，15px 正文 `0`，12.5px 按钮 `+0.1em`，9.5px 标签 `+0.12em`，字标 `+0.18em`。这是打字机与铅字排版的物理事实。**不得出现大字号配大字距**。唯一豁免是图章 —— 橡皮章的字距来自刻版而非排版，`stamp-display` 在 44px 上仍用 `+0.12em`。

**The Closed Ramp Rule.** 上表 21 个角色就是全部字阶，**没有第 22 个**。需要一个新字号时，先问它是不是已有角色的新用法；确实是新角色，就先写进这张表再写进代码，而不是反过来。检测器会拦住任何表外的字面字号。

**The Container Unit Rule.** 单据容器开了 `container-type: inline-size`，所以流体字号一律用 `cqw`。**`vw` 在这套系统里是错的** —— 它跟随视口而不是单据，在宽屏上单据固定 1120px 而字号还在涨。

## Layout

**容器（`.wb-sheet` / `.wb-desk`）**：单据居中，左右各一条 1px 格线，底色正本联；容器外是柜台米。启用 `container-type: inline-size`，所有 `cqw` 相对单据宽度而非视口。

宽度是**流体**的，上限 1400px：窄屏满幅（桌面不可见），`≥768px` 起由 `.wb-desk` 的 `padding: 0 clamp(24px, 4vw, 200px)` 留出桌面。实测 1920 下单据 1400 / 占屏 73% / 两侧各 260px；1440 下 1325px；1280 下 1178px；375 下满幅 375px。

**Hero（`.wb-hero`）**：`≥768px` 为 `minmax(0, 1.6fr) minmax(240px, 0.7fr)` 两栏栅格，gap 32px，图章独占右栏；窄屏单栏堆叠。**不要用 `justify-content: space-between` 排 Hero** —— 那样剩余空间会全部堆积成正文与图章之间的空洞（改前 1440 下约 400px）。栅格分配空间，`space-between` 只是把空间剩下。

**齿孔边**：单据**顶部与底部各一条** 14px 高的打孔带，用 `repeating-radial-gradient` 打出 18×14px 间距的柜台米色圆孔。它是单据从连续纸卷上撕下来的证据 —— **两端都要有**，只打一端读起来是「撕了一半没撕断」。底部齿孔同时让页脚读作存根边。

**区块节奏**：每个区块是一条横向带，用 `border-bottom: 1px solid` 格线 分隔，内边距 `22px 20px 26px`。**区块之间不留外边距** —— 单据上的栏目是紧挨着的，靠线分不靠空分。

**字段网格**：`FieldGrid` 用 `flex-wrap` + `flex: 1 1 152px`，配合容器的上边框和左边框，每个单元只画右边框和下边框。这样无论换行到几行，格线永远闭合成完整网格，不会出现悬空的线头。宽字段用 `flex: 2 1 320px` 占双格。

**响应式**：`flex-wrap` 是区块内的主要手段。媒体查询只在内联样式装不下时使用，全部收口在 `theme.css`，共三处断点：`768px`（桌面留白、Hero 栅格）、`640px`（顶栏拆行、对照表拆卡）、JS 的 `640px`（`SubscriptionCard` 截断 URL）。

**宽表格**：短数据表（明细表）用 `overflow-x: auto` + 贴合数据的 `min-width` 即可。**装句子的表（`.wb-compare` 两联对照）在 `≤640px` 必须拆卡** —— 三列 540px 落进 331px 容器要横滚 209px，而拖动才能看到的恰恰是「登机联」那一列，即付费理由。拆卡后每行变一张卡：项目名做卡头（账带底），两个值各自用 `data-th` 补回列名。`thead` 视觉隐藏但保留给读屏。

**间距节奏**：1 / 5 / 9 / 12 / 20 / 26px。字段单元 `9px 11px 11px`（底部多 2px，为基线视觉居中），按钮 `12px 20px`，区块 `22px 20px 26px`。

### Named Rules

**The Closed Grid Rule.** 任何网格状结构都必须闭合。容器画上边框和左边框，单元画右边框和下边框。**永远不要让格线出现开口或悬空线头** —— 那是单据做假的第一个破绽。

**The No-Gap Rule.** 区块之间用格线分隔，不用 margin。需要视觉呼吸时增加区块内边距，不增加区块间距。

**The Allocated Space Rule.** 多栏结构一律用栅格并给每一栏声明宽度，**不用 `justify-content: space-between` 配 `flex: 0 0 auto`**。后者在宽屏上把所有剩余空间堆成一个洞，且洞随视口增长。判据：把视口拉到 2560，如果某处空白变大了，那里就该是栅格。

**The Growing Sheet Rule.** 单据宽度与展示字阶必须一起改。容器放宽而 `cqw` 系数不动，只会得到一张更大更空的纸；字阶放大而容器不动，会挤爆 `white-space: nowrap` 的运单号。改任一侧前先算另一侧。

**The Dense Sheet Rule（本轮最贵的教训）。** 单据是**密**的文档，不是海报。宽度多出来时，正确的用法是**装更多信息**，不是把同样的信息放大。

判据：**任何一个格子里，值的宽度不应小于格子宽度的三分之一。** 违反时有三个正确动作 —— 加字段、限制该区块宽度、或把它并进相邻区块；**放大字号是错的**，它只会让稀疏变得刺眼。

具体前车之鉴：概况栏曾是 4 格独占一条全宽横带，1400px 下每格 340px 只装「04:00 UTC+8」；修法是并入运单抬头并补到 6 格（含存活率与校验位），不是把值从 13px 放到 19px。明细表曾 `width:100%` 拉满 1360px，三列装 2–6 字符的短值，COUNT 列飘到离 PROTOCOL 450px 远；把三列表封顶到 `760px` 又会在宽单据右侧留下近半张空纸。最终桌面按原始顺序把连续两条记录排成六列并用满内容宽度，`<768px` 回到单组三列表。宽度因此用来装更多信息，而不是拉开相同三个字段。

**汉语断行不在此列。** 汉字可以在任意两字之间断行，这是正常的中文排版，不是缺陷。`text-wrap: pretty` 与 `word-break: auto-phrase` 是锦上添花的渐进增强，不要把它们当成在修 bug，也不要为了避免断行去改字号或宽度。

## Elevation & Depth

**这套系统没有阴影，而且是写死的：**`*, *::before, *::after { box-shadow: none }`。深度完全由三种手段提供：

1. **1px 实线格线** —— 结构分层的主力
2. **色调分层** —— 柜台米（最底）→ 账带 → 正本联（最上），三档暖灰构成层级，外加分联底色按语义分区

   **这是本系统对抗「太平」的主力手段，必须真的部署。** 曾经首页六个区块背景全是 `transparent`，整页只有一个颜色，读起来毫无层次 —— 当时的直觉是「加阴影」，但正确答案是把已经声明好的纸色用起来。现行分配：运单抬头 = 正本联；教程区 = 黄联（`copy-buff` 就是为教程联预留的）；撕线 = 正本联；登机联推介（两联对照 + 四档舱位）= 账带，两段共用一个色块且中间不加格线；FAQ = 正本联。`/upgrade` 同理：说明段留正本联，套餐 + 折扣码 + 登机入口合成账带色块。

   **判据：任意一页里，如果所有区块的 `background` 都解析成 `rgba(0,0,0,0)`，这一页一定是平的。**
3. **`mix-blend-mode: multiply` 叠印** —— 图章与页面纸纹噪点叠加时使用，模拟油墨渗进纸里而不是浮在纸上

**允许"纸叠纸"。**平面是底线但不是禁欲：可以用错位、边缘重叠、截角来暗示多张纸叠在一起 —— 存根堆叠、联与联之间的位移、套印错位都属于这一类。**判据是：这个深度感在物理上必须能由"两张纸的相对位置"解释。**能，就允许；需要靠光影解释，就不允许。

**纸纹噪点**：一层 `position: fixed` 的 SVG `feTurbulence` 分形噪点覆盖全屏，`opacity: .07`，`mix-blend-mode: multiply`，`z-index: 60`，`pointer-events: none`。它是整套系统里唯一的全局材质层。

调这个值不要靠肉眼估。噪点层自身的灰阶只有 **131–233**（一条中灰带，不是满幅），所以在正本联 `251` 上 multiply 后的实际色阶跨度是：`.025` → 2 级（等于不存在）、`.04` → 4 级（勉强到阈值）、`.07` → 7 级（读作纸纤维）、`.11` → 11 级（开始读作灰尘）。**`.07` 是纸感与干净之间的甜点**，低于 `.05` 这层材质等于白做。multiply 对前景背景等比压暗，所以提高它不会改变任何文字的对比度。

### Named Rules

**The Paper Physics Rule.** 深度必须能用两张纸的相对位置解释。错位、重叠、打孔、撕口 —— 可以。投影、模糊、发光、玻璃拟态 —— 不可以。**`box-shadow` 与 `filter: drop-shadow` 在这套系统里等同于语法错误。**

**The Multiply Ink Rule.** 凡是"盖上去的东西"（图章、噪点、放行章）走 `mix-blend-mode: multiply`；凡是"印上去的东西"（正文、格线、按钮）走实色。这条区分决定了油墨是压在纸上还是浮在纸上。

**The Still Paper Rule（动效论点）。** **纸是静的，唯一会动的是章。**

整套系统只有一个被创作的时刻：`stamp-slam`（180ms，末端过冲的橡皮章回弹）。它是产品主张"查验通过才有章"在时间维度上的同构物。**不要加第二个焦点时刻** —— 每加一个，章就轻一分。

焦点之外，动效只允许承担**连续性**与**反馈**：披露状态变化用 `.wb-reveal`（240ms `cubic-bezier(.16,1,.3,1)`，动 `grid-template-rows` 而非 `height`），换联用同曲线解释"换了一张纸"。曲线一律用这条自然减速；**回弹只属于图章**。

**禁止入场动画。** 曾经每个区块都套同一个淡入上移，由 JS 先设 `opacity: 0` 再靠 IntersectionObserver 揭开。三重错误：它是"每个区块同一个入场"这一公认反模式；它不是论点，只是效果；最严重的是**内容默认隐藏** —— 打印、Ctrl+F 跳转、脚本抛错都会让整段永远不显示（整页截图下半部分全白就是症状）。纸交到你手上时是完整的，不会一段段淡进来。

**判据：禁用 JavaScript 后，整页内容必须全部可达。**

"可达"不等于"展开"。要区分两件事：

- **禁止**：脚本把内容藏起来、且用户没有任何操作可以取回它（原来的入场动画就是这样）。
- **允许**：用户主动控制的原生披露，`<details>/<summary>`、`<dialog>`。它有可见的开关、零 JS 可展开、键盘语义免费，Chrome/Edge 的 Ctrl+F 还会自动展开命中项。

FAQ 因此从 React 手风琴换成了原生 `<details>`：改前答案根本不在服务端 HTML 里，关 JS 后彻底读不到、页内查找也找不到；改后七条答案全部进入 HTML，收起只是默认视图。**判据看的是可达性，不是初始展开状态。**

## Shapes

**圆角为零，全局写死。**`*, *::before, *::after { border-radius: 0 }`。这不是审美偏好，是身份声明：单据没有圆角。任何 `border-radius` 的引入都会立刻让这套系统读起来像一个通用 web 应用。

**边框是唯一的形状语言。**1px 实线 = 结构；1px 虚线 = 可撕开/可分离（骑缝线、页脚分隔）；2px 下边框 = 导航当前项；2.4px 实线矩形 = 图章边框；3px 单边线 = 通知条的分类标记（章紫 = 提示，作废红 = 失效，官方蓝 = 升舱区套餐）。

**圆形只属于图章。**整套系统里唯一的圆是橡皮图章的双线圆环（`r=47` 2.2px + `r=42.5` 1px），以及齿孔边和骑缝线缺口的打孔半圆。**圆形不得用于头像、徽标、按钮或指示点。**

**旋转只属于图章。**`rotate(-5deg)` / `rotate(-6deg)` 是盖章的手抖，只用在 `Stamp` 与「已放行」章上。其他任何元素不得旋转。

### Named Rules

**The Zero Radius Rule.** `border-radius` 的允许值只有 `0`。二维码画布、按钮、卡片、输入框、图片，无一例外。这条规则在 `theme.css` 的通配选择器上强制执行，任何绕过它的写法都是在破坏身份。

**The Border Vocabulary Rule.** 边框宽度是有语义的：1px 实线 = 结构，1px 虚线 = 可撕，2px = 当前位置，2.4px = 图章，3px 单边 = 分类标记。**不要引入新的边框宽度**，需要新语义时先问它是不是已有五种之一。

## Components

### Buttons

- **Shape:** 直角矩形（`0`），永远。边框 1px 实线或无边框实心
- **Primary（复制订阅）:** 主墨底 (`#2A2333`) + 正本联字 (`#FBFAF7`)，内边距 `12px 20px`，Mono 12.5px 全大写 `+0.1em`。它是页面上最重的一个动作，实心是它的权重来源
- **Ghost（一键导入 / 二维码）:** 透明底 + 1px 主墨边框 + 主墨字，内边距 `11px 18px`
- **Port（升舱主 CTA）:** 官方蓝底 + 正本联字，内边距 `14px 24px`。**只在 `/upgrade` 出现**
- **Port Ghost（Telegram 群组）:** 透明底 + 1px 官方蓝边框 + 官方蓝字
- **Hover / Focus:** 焦点走全局 `:focus-visible { outline: 2px solid 章紫; outline-offset: 2px }`。**按钮不做 hover 位移、不做阴影生长、不做背景渐变** —— 手感定调是「像盖章一样确定」，按下即成事实，过渡态不表演犹豫

### Ply Tabs（换联切换）

- **Style:** 横向控制条置于订阅区顶部，底色账带，条内每项右侧 1px 格线
- **State:** 选中项底色切换为该联的纸色（绿联 / 粉联）且字重 600；未选中透明底、字重 400
- **Behavior:** 切换时整个订阅区底色以 `240ms ease-out` 过渡 —— 这是"换了一张纸"，是全系统唯一允许的大面积颜色过渡

### Cards / Containers

- **Corner Style:** 直角 (`0`)
- **Background:** 正本联为主；分区用复写纸底色
- **Shadow Strategy:** 无。见 Elevation & Depth
- **Border:** 1px 实线格线
- **Internal Padding:** 区块 `22px 20px 26px`，字段单元 `9px 11px 11px`

### Inputs / Fields

系统中没有真正的文本输入框。字段的呈现形式是**只读栏位**：左上角 Mono 全大写淡墨标签，下方 Mono 13px 主墨值，四周由闭合网格的格线界定。订阅链接框是一个 1px 格线容器，内部用 `gap:1px` + 格线底色做出"两个格子拼在一起"的效果（链接格 + 复制按钮）。

### Navigation

- **Style:** sticky 顶栏，正本联底，底部 1px 格线。左侧字标「舱单」(得意黑 21px) + 1px 竖线 + `MANIFEST` (Mono 10px `+0.18em` 次墨)
- **Typography:** Mono 11px `+0.1em` 全大写，每项含中文标签 + 路径码（`今日舱单 /today`），路径码用次墨
- **States:** 当前项 2px 下边框（章紫；升舱项用官方蓝）；非当前项 transparent 下边框，保持占位不跳动
- **Mobile (≤640px):** 品牌与导航拆成上下两行；导航压成**单行不换行**（`flex-wrap: nowrap` + `overflow-x: auto`，滚动条隐藏，左右出血到屏幕边缘），**路径码隐藏**，每项 `min-height: 44px` 保证触摸目标
- **实测（Chromium，生产构建，2026-07-30）:** 顶栏高 375px 下 `89px`、桌面 `48px`；六项实际总宽 `300px`，375px 视口单行容纳且**不触发横向滚动**；320px 视口下滚动 18px，末项被裁切正好提示可滑动。滚动 900px 后 sticky 仍 `top=0`。复现命令 `npm run measure:mobile`
- **实现位置:** 顶栏是全站唯一由 `theme.css` 类（`.wb-head` / `.wb-nav` / `.wb-nav-code`）而非内联样式承担结构的组件 —— 媒体查询写不进内联样式。当前项下划线颜色仍由 `Shell.astro` 内联计算，因为它是每项动态的

### 图章 Stamp（签名组件）

橡皮图章。SVG 双线圆环（`r=47` 2.2px + `r=42.5` 1px，章紫，opacity .9/.75），环内沿路径排布 `FREEDOMPORT · 自由港 · MANIFEST ·`（Mono 7.4px，字距 1.6），中心一枚飞机剪影。整体 `rotate(-5deg)` + `mix-blend-mode: multiply`。下方可选日期位（Mono 600 13px `+0.16em`，点分隔 `2026.07.30`）。

### 已放行章 Cleared Stamp（签名组件）

复制成功后的唯一庆祝。2.4px 章紫实线矩形，内含「已放行」(Mono 600 17px `+0.1em`) + `CLEARED` (Mono 9.5px `+0.24em`)，`opacity .92`，`mix-blend-mode: multiply`，`stamp-slam 180ms` 从 `scale(1.9) rotate(-6deg)` 砸落到 `scale(1)`。**这是整套系统里唯一的高光时刻，不得被稀释成一个 toast。**

### 放行遮罩 Clearance Veil（签名组件）

订阅链接区上方的 3 秒不透明遮罩（放行帘底色）。中央一枚 76px 脉动图章（`stamp-pulse 900ms` 无限循环），下方「正在放行… 3S」(Mono 12px `+0.16em` 章紫) 与「放行后即可复制订阅链接」(Mono 10px 淡墨)。它把等待包装成柜台后正在进行的查验。

第二行**不是第一行的英文对照**。Bilingual Label Rule 只管字段标签；状态行的第二行必须提供新信息 —— 原本写的 `CLEARANCE IN PROGRESS` 是上一行的直译，等于什么都没说。凡是状态、等待、错误的辅助行，问一句「它是否告诉了用户接下来会怎样」，答案是否就删掉或重写。

### 骑缝线 Tear Line（签名组件）

分隔免费联与登机联。两条 1px 虚线（淡墨）中间夹一句 Mono 10.5px 次墨说明（`—— 沿虚线撕开，以下为登机联 ——`）。左右两端各有一个 10×18px 的柜台米半圆缺口（`radial-gradient`），骑在单据边框上，模拟打孔撕口。

### 套印错位 Misregistration（签名装置）

主标题与运单号背后一层 `translate(1.5px, 1.5px)`、`opacity: .18`、套印墨绿的同文字影层，`aria-hidden`。模拟双色印刷没对准。

**每一个页面 h1 都必须有它，一个不漏**（首页、升舱、FAQ、往期存根；今日与存根页的 h1 是运单号，同样带）。它是页面级标题的身份标记 —— 少一处，那一页就悄悄退出了系统。**但不得下放到区块标题或正文。**

## Do's and Don'ts

### Do:

- **Do** 用 1px 实线格线做一切分隔，让网格闭合（容器画上/左，单元画右/下）
- **Do** 新增字段时遵守 `ENGLISH / 中文` 双语标签格式，Mono 全大写，淡墨
- **Do** 让字距随字号反向变化：越小的字，字距越大
- **Do** 把状态表达交给文字与图章，颜色只有章紫（成立）与作废红（作废）两种
- **Do** 用 `mix-blend-mode: multiply` 表现"盖上去"的东西，实色表现"印上去"的东西
- **Do** 在需要深度时，先问它能否用两张纸的相对位置解释
- **Do** 新增中文大标题前先确认字形在得意黑的 101 个汉字子集内（拉丁与数字已全覆盖）
- **Do** 把官方蓝整块使用（整个按钮、整列表格），并只用在升舱路径上

### Don't:

- **Don't** 引入任何 `border-radius`，允许值只有 `0`
- **Don't** 引入任何 `box-shadow` 或 `filter: drop-shadow`，在这套系统里等同于语法错误
- **Don't** 因为对比度审计把 10–11px Mono 字段标签从淡墨 (`#A9A3B2`) 改深 —— 这是已裁决的接受项
- **Don't** 把法律文本、免责声明或说明性句子用淡墨，它们必须用次墨 (`#6B6478`)
- **Don't** 在免费联的任何位置使用官方蓝，那会摧毁与自由港的品牌区隔
- **Don't** 引入第三种状态色（成功绿、警告黄、提示橙），状态靠文字和图章说
- **Don't** 让圆形或旋转出现在图章之外的任何元素上
- **Don't** 把套印错位下放到区块标题或正文，它只属于运单号与主标题
- **Don't** 给按钮加 hover 位移、阴影生长或背景渐变，手感是「像盖章一样确定」
- **Don't** 增加得意黑大标题的数量，每页最多一个 h1 加字标
- **Don't** 用 margin 分隔区块，区块之间靠格线
- **Don't** 让这套系统滑向以下四者中的任何一个：**通用 SaaS / 现代 dashboard**（圆角卡片、柔和阴影、渐变按钮）、**航空公司营销站**（大幅天空摄影、明亮品牌蓝、营销感文案）、**黑客 / 极客终端风**（暗底、荧光绿、Matrix 字雨、假终端）、**免费资源聚合站**（密集链接列表、闪烁的"今日更新"、弹窗广告位、多个互相矛盾的 CTA）
