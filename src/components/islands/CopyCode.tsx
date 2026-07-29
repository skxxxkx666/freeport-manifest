import { useState } from "react";

export default function CopyCode({ code = "FREEDOM2026" }: { code?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => { setCopied(false); requestAnimationFrame(() => setCopied(true)); };
    navigator.clipboard?.writeText(code).then(done, done) ?? done();
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 22px", alignItems: "center" }}>
      <button
        type="button"
        onClick={copy}
        aria-label={`复制折扣码 ${code}`}
        style={{ appearance: "none", background: "transparent", border: 0, padding: 0, cursor: "pointer", flex: "0 0 auto", mixBlendMode: "multiply", transform: "rotate(-2deg)" }}
      >
        <div style={{ border: "2.6px solid #7B3F9D", padding: 4 }}>
          <div style={{ border: "1px solid #7B3F9D", padding: "11px 20px 9px", display: "grid", gap: 4, justifyItems: "center" }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".24em", color: "#7B3F9D", textTransform: "uppercase" }}>DISCOUNT CODE</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: "clamp(21px,3.2cqw,29px)", letterSpacing: ".1em", color: "#7B3F9D", lineHeight: 1.1 }}>{code}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".16em", color: "#7B3F9D" }}>点击复制</div>
          </div>
        </div>
      </button>
      <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#6B6478", textWrap: "pretty" }}>
          在自由港官网下单时,于结算页的优惠码一栏粘贴此码。适用于全部四档套餐。
        </p>
        {copied && (
          <div aria-hidden="true" style={{ width: "fit-content", mixBlendMode: "multiply", animation: "stamp-slam 180ms cubic-bezier(.2,.9,.3,1.2) both" }}>
            <div style={{ border: "2px solid #7B3F9D", padding: "5px 12px 4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 13, letterSpacing: ".1em", color: "#7B3F9D", lineHeight: 1.1 }}>已复制</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, letterSpacing: ".24em", color: "#7B3F9D" }}>COPIED</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
