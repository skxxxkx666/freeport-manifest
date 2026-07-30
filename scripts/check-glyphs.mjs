// 构建后检查:所有用得意黑显示的汉字,字形是否都在子集里。
//
// 得意黑子集只有 101 个汉字。用到子集外的字时浏览器不会报错,而是静默回退到系统体
// —— 系统体带真粗体,于是那一个字看起来比周围明显更粗。这是个只能靠肉眼发现的 bug,
// 曾经真的漏出去过(「选对客户端」的「对」)。
//
//   npm run check:glyphs        # 需要先 npm run build
//
// 报错时的两条路:改文案避开缺字(最快),或按 README「子集化得意黑」一节重跑
// pyftsubset 并同步更新那份字表。产物超过 50KB 说明标题用字太散,收敛文案而不是放宽预算。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const FONT = "public/fonts/smiley-sans-subset.ttf";
const DIST = "dist";

/** 解析 TTF 的 cmap format 4,返回覆盖的码点集合 */
function coveredCodepoints(path) {
  const b = readFileSync(path);
  let cmapOff = 0;
  for (let i = 0, n = b.readUInt16BE(4); i < n; i++) {
    const o = 12 + i * 16;
    if (b.toString("ascii", o, o + 4) === "cmap") cmapOff = b.readUInt32BE(o + 8);
  }
  assert.ok(cmapOff, `${path}: 找不到 cmap 表`);

  let sub = 0;
  for (let i = 0, n = b.readUInt16BE(cmapOff + 2); i < n; i++) {
    const rec = cmapOff + 4 + i * 8;
    const pid = b.readUInt16BE(rec), eid = b.readUInt16BE(rec + 2);
    const off = cmapOff + b.readUInt32BE(rec + 4);
    if (b.readUInt16BE(off) === 4 && (pid === 3 || pid === 0)) {
      sub = off;
      if (pid === 3 && eid === 1) break;
    }
  }
  assert.ok(sub, `${path}: 找不到 format 4 的 cmap 子表`);

  const segX2 = b.readUInt16BE(sub + 6);
  const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const out = new Set();
  for (let i = 0; i < segX2 / 2; i++) {
    const end = b.readUInt16BE(endO + i * 2), start = b.readUInt16BE(startO + i * 2);
    if (start === 0xffff) continue;
    const delta = b.readInt16BE(deltaO + i * 2), ro = b.readUInt16BE(rangeO + i * 2);
    for (let cp = start; cp <= end && cp !== 0x10000; cp++) {
      let g;
      if (ro === 0) g = (cp + delta) & 0xffff;
      else {
        const gi = rangeO + i * 2 + ro + (cp - start) * 2;
        if (gi + 1 >= b.length) continue;
        g = b.readUInt16BE(gi);
        if (g) g = (g + delta) & 0xffff;
      }
      if (g) out.add(cp);
    }
  }
  return out;
}

function htmlFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

const have = coveredCodepoints(FONT);
const files = htmlFiles(DIST);
assert.ok(files.length, `${DIST}/ 里没有 HTML —— 先跑 npm run build`);

// 抓所有 style 含 --font-display 的标签,取其直接文本(标签内、下一个 < 之前的部分)
const TAG = /<([a-z0-9]+)\b[^>]*style="[^"]*--font-display[^"]*"[^>]*>([^<]*)/gi;
const missing = new Map();
let checked = 0;

for (const f of files) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(TAG)) {
    const text = m[2].replace(/&[a-z]+;|&#\d+;/gi, "");
    if (!text.trim()) continue;
    checked++;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      // 只管 CJK 与中文标点;拉丁与数字子集已全覆盖
      if (cp > 0x2e80 && !have.has(cp)) {
        if (!missing.has(ch)) missing.set(ch, new Set());
        missing.get(ch).add(`${f.replace(/\\/g, "/")} 「${text.trim().slice(0, 16)}」`);
      }
    }
  }
}

if (missing.size) {
  const lines = [...missing].map(
    ([ch, where]) => `  「${ch}」 U+${ch.codePointAt(0).toString(16).toUpperCase()}  ← ${[...where].join("\n      ← ")}`
  );
  assert.fail(
    `得意黑子集缺 ${missing.size} 个字形,这些字会静默回退到系统体(看起来更粗):\n\n${lines.join("\n")}\n\n` +
      `改标题文案避开这些字,或按 README「子集化得意黑」重跑 pyftsubset 并更新字表。`
  );
}

console.log(`字形检查通过：${files.length} 个 HTML，${checked} 处得意黑文本，子集覆盖 ${have.size} 个码点`);
