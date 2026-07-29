import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { deepLinks, truncateUrl } from "../../lib/waybill";

type Ply = "clash" | "v2ray";

export interface Props {
  clash: string;
  v2ray: string;
  nodeCount: number;
  regions: string[];
  protocols: string[];
  checkCode: string;
  remark?: string;
  date: string;
  revealSeconds?: number;
}

const SHEET: Record<Ply, { code: string; name: string; bg: string }> = {
  clash: { code: "02 GREEN", name: "绿联 CLASH", bg: "#E2EDE0" },
  v2ray: { code: "03 PINK", name: "粉联 V2RAY", bg: "#F6E3E4" }
};


export default function SubscriptionCard(p: Props) {
  const [ply, setPly] = useState<Ply>("clash");
  const [locked, setLocked] = useState(true);
  const [left, setLeft] = useState(p.revealSeconds ?? 3);
  const [cleared, setCleared] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [count, setCount] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const sub = ply === "clash" ? p.clash : p.v2ray;
  const storeKey = "manifest-cleared-" + p.date.replace(/-/g, "");

  useEffect(() => {
    const mq = matchMedia("(max-width: 640px)");
    const on = (e: MediaQueryListEvent | MediaQueryList) => setNarrow(e.matches);
    on(mq);
    mq.addEventListener("change", on as (e: MediaQueryListEvent) => void);
    try { setCount(parseInt(localStorage.getItem(storeKey) ?? "0", 10) || 0); } catch { /* 隐私模式 */ }
    return () => mq.removeEventListener("change", on as (e: MediaQueryListEvent) => void);
  }, [storeKey]);

  /* §9.2 防薅:进页遮罩 revealSeconds 秒,不做人机验证 */
  useEffect(() => {
    const secs = p.revealSeconds ?? 3;
    if (!secs) { setLocked(false); setLeft(0); return; }
    setLocked(true); setLeft(secs);
    const t = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) { clearInterval(t); setLocked(false); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [p.revealSeconds]);

  useEffect(() => {
    if (!qrOpen || !canvas.current) return;
    QRCode.toCanvas(canvas.current, sub, { width: 148, margin: 1, color: { dark: "#2A2333", light: "#FBFAF7" } })
      .then(() => setQrFailed(false))
      .catch(() => setQrFailed(true));
  }, [qrOpen, sub]);

  const copy = useCallback(() => {
    const done = () => {
      setCleared(false);
      requestAnimationFrame(() => setCleared(true));
      setCount((n) => {
        const next = n + 1;
        try { localStorage.setItem(storeKey, String(next)); } catch { /* 隐私模式 */ }
        return next;
      });
    };
    navigator.clipboard?.writeText(sub).then(done, done) ?? done();
  }, [sub, storeKey]);

  const sheet = SHEET[ply];
  const links = deepLinks(ply, sub);

  return (
    <div style={{ position: "relative", background: sheet.bg, borderBottom: "1px solid #C9C2CE", transition: "background 240ms ease-out" }}>
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #C9C2CE", background: "#F1EFE9" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: ".12em", color: "#A9A3B2", textTransform: "uppercase", borderRight: "1px solid #C9C2CE" }}>
          COPY / 换联
        </div>
        {(["clash", "v2ray"] as Ply[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setPly(k); setCleared(false); }}
            aria-pressed={ply === k}
            style={{ appearance: "none", border: 0, borderRight: "1px solid #C9C2CE", background: ply === k ? SHEET[k].bg : "transparent", color: "#2A2333", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".1em", padding: "13px 18px", cursor: "pointer", textTransform: "uppercase", fontWeight: ply === k ? 600 : 400 }}
          >
            {k.toUpperCase()} <span style={{ fontFamily: "'PingFang SC',sans-serif", letterSpacing: ".04em" }}>{k === "clash" ? "绿联" : "粉联"}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".14em", color: "#6B6478", textTransform: "uppercase" }}>
            SHEET {sheet.code} / {sheet.name}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".1em", color: "#6B6478" }}>今日已放行 {count} 次</div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid #C9C2CE", borderLeft: "1px solid #C9C2CE", marginBottom: 16 }}>
          {[
            ["CARRIER / 承运方", "公开来源聚合"],
            ["ORIGIN / 始发", p.regions.join(" ")],
            ["PIECES / 件数", p.nodeCount + " PCS"],
            ["COMMODITY / 品类", p.protocols.join(" ")],
            ["CHECK / 校验位", p.checkCode],
            ...(p.remark ? [["REMARKS / 备注", p.remark] as [string, string]] : [])
          ].map(([l, v], i, arr) => (
            <div key={l} style={{ flex: p.remark && i === arr.length - 1 ? "2 1 320px" : "1 1 152px", minWidth: 0, padding: "9px 11px 11px", borderRight: "1px solid #C9C2CE", borderBottom: "1px solid #C9C2CE" }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: ".12em", color: "#A9A3B2", textTransform: "uppercase", marginBottom: 5 }}>{l}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ position: "relative", border: "1px solid #C9C2CE", background: "#FBFAF7" }}>
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: ".12em", color: "#A9A3B2", textTransform: "uppercase", marginBottom: 8 }}>
              SUBSCRIPTION URL / 订阅链接
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "#C9C2CE", border: "1px solid #C9C2CE", marginBottom: 12 }}>
              <div style={{ background: "#FBFAF7", flex: "1 1 240px", minWidth: 0, padding: "12px 13px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {narrow ? truncateUrl(sub) : sub}
              </div>
              <button type="button" onClick={copy} style={{ appearance: "none", border: 0, background: "#2A2333", color: "#FBFAF7", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, letterSpacing: ".1em", padding: "12px 20px", cursor: "pointer", textTransform: "uppercase", flex: "1 1 auto" }}>
                复制订阅 COPY
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {links.map((l) => (
                <a key={l.client} href={l.href} style={{ border: "1px solid #2A2333", background: "transparent", color: "#2A2333", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, letterSpacing: ".08em", padding: "11px 18px" }}>
                  一键导入 {l.client}
                </a>
              ))}
              <button type="button" onClick={() => setQrOpen((v) => !v)} aria-expanded={qrOpen} style={{ appearance: "none", border: "1px solid #2A2333", background: "transparent", color: "#2A2333", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, letterSpacing: ".08em", padding: "11px 18px", cursor: "pointer" }}>
                {qrOpen ? "收起二维码 QR" : "二维码 QR"}
              </button>
            </div>

            {qrOpen && (
              <div style={{ marginTop: 12, border: "1px solid #C9C2CE", padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {qrFailed ? (
                  <div style={{ width: 148, height: 148, border: "1px solid #C9C2CE", backgroundImage: "repeating-linear-gradient(45deg,#EDEAE3 0 5px,#FBFAF7 5px 10px)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, lineHeight: 1.8, color: "#6B6478" }}>
                    二维码不可用<br />请改用复制链接
                  </div>
                ) : (
                  <canvas ref={canvas} width={148} height={148} style={{ display: "block", width: 148, height: 148, imageRendering: "pixelated" }} />
                )}
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, lineHeight: 1.8, letterSpacing: ".06em", color: "#6B6478" }}>
                  QR / 扫码取用<br />{sheet.name} · {p.nodeCount} PCS
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, borderTop: "1px solid #C9C2CE", paddingTop: 10, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, lineHeight: 1.7, color: "#6B6478" }}>
              免费节点由公开来源聚合,随时可能失效,不提供任何保障。
            </div>

            {cleared && (
              <div aria-hidden="true" style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <div style={{ mixBlendMode: "multiply", animation: "stamp-slam 180ms cubic-bezier(.2,.9,.3,1.2) both" }}>
                  <div style={{ border: "2.4px solid #7B3F9D", padding: "7px 14px 6px", opacity: 0.92 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 17, letterSpacing: ".1em", color: "#7B3F9D", lineHeight: 1.1 }}>已放行</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: ".24em", color: "#7B3F9D" }}>CLEARED</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {locked && (
            <div style={{ position: "absolute", inset: 0, background: "#F3F1EC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 5 }}>
              <div style={{ mixBlendMode: "multiply", animation: "stamp-pulse 900ms ease-in-out infinite" }}>
                <svg width="76" height="76" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#7B3F9D" strokeWidth="2.4" opacity=".85" />
                  <circle cx="50" cy="50" r="41" fill="none" stroke="#7B3F9D" strokeWidth="1" opacity=".6" />
                  <path d="M50 27 L55.5 45 L73 57 L73 60.5 L54 55.5 L53 68 L59.5 74 L59.5 77 L50 74 L40.5 77 L40.5 74 L47 68 L46 55.5 L27 60.5 L27 57 L44.5 45 Z" fill="#7B3F9D" opacity=".85" />
                </svg>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".16em", color: "#7B3F9D", textTransform: "uppercase" }}>正在放行… {left}S</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".1em", color: "#A9A3B2" }}>CLEARANCE IN PROGRESS</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
