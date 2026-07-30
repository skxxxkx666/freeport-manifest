// 窄屏布局实测。README「已知未验证项」里的 375 宽度一条靠它出数,不再手量。
//
//   npm run build && npx astro preview --port 4322
//   node scripts/measure-mobile.mjs
//
// BASE 可覆盖(默认 http://localhost:4322),OUT 覆盖截图目录。
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4322";
const OUT = process.env.OUT || "output/playwright";
const ROUTE = process.env.ROUTE || "/today";

const viewports = [
  { name: "375x812", width: 375, height: 812, mobile: true, shot: true },
  { name: "320x568", width: 320, height: 568, mobile: true, shot: false },
  { name: "1280x900", width: 1280, height: 900, mobile: false, shot: false }
];

// 在页面里跑,量的是布局事实而不是意图。
const probe = () => {
  const q = (s) => document.querySelector(s);
  const head = q(".wb-head");
  const nav = q(".wb-nav");
  const items = [...nav.querySelectorAll(":scope > a")];
  // 同一 top 值算一行 —— 换行数是布局是否被撑开的直接证据
  const rows = new Set(items.map((a) => Math.round(a.getBoundingClientRect().top))).size;
  const wrap = [...document.querySelectorAll("div")].find(
    (d) => d.style.overflowX === "auto" && d.querySelector("table")
  );
  const table = wrap?.querySelector("table");
  return {
    viewport: window.innerWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    pageOverflowsX: document.documentElement.scrollWidth > window.innerWidth,
    headHeight: Math.round(head.getBoundingClientRect().height),
    navRows: rows,
    navClientWidth: nav.clientWidth,
    navScrollWidth: nav.scrollWidth,
    navOverflowsX: nav.scrollWidth > nav.clientWidth,
    navItemsTotalWidth: Math.round(items.reduce((n, a) => n + a.getBoundingClientRect().width, 0)),
    minItemHeight: Math.min(...items.map((a) => Math.round(a.getBoundingClientRect().height))),
    codeDisplay: getComputedStyle(q(".wb-nav-code")).display,
    tableClientWidth: wrap ? wrap.clientWidth : null,
    tableScrollWidth: wrap ? wrap.scrollWidth : null,
    tableOverflowsX: wrap ? wrap.scrollWidth > wrap.clientWidth : null,
    tableMinWidth: table ? table.style.minWidth : null
  };
};

const browser = await chromium.launch();
const results = {};

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile
  });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: "networkidle" });
  await page.waitForTimeout(3600); // 等 3 秒放行遮罩收起,量到的是稳态

  const m = await page.evaluate(probe);

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(250);
  m.stickyTopAfterScroll900 = await page.evaluate(() =>
    Math.round(document.querySelector(".wb-head").getBoundingClientRect().top)
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);

  if (vp.shot) {
    // 按路由命名,否则换 ROUTE 跑一次会覆盖上一条路由的截图
    const slug = ROUTE.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "index";
    await page.screenshot({ path: `${OUT}/${slug}-${vp.width}.png` });
    await page.screenshot({ path: `${OUT}/${slug}-${vp.width}-full.png`, fullPage: true });
  }

  results[vp.name] = m;
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
