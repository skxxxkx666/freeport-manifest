import { useState } from "react";

export default function FaqAccordion({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(-1);
  return (
    <>
      {items.map(([q, a], i) => (
        <div key={q} style={{ borderBottom: "1px solid #C9C2CE" }}>
          <button
            type="button"
            id={`faq-btn-${i}`}
            aria-expanded={open === i}
            aria-controls={`faq-panel-${i}`}
            onClick={() => setOpen(open === i ? -1 : i)}
            style={{ appearance: "none", width: "100%", textAlign: "left", border: 0, background: open === i ? "#F1EFE9" : "transparent", color: "#2A2333", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14 }}
          >
            <span style={{ flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: ".12em", color: "#A9A3B2" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ flex: "1 1 auto", fontFamily: "'Smiley Sans','Archivo Narrow','PingFang SC',sans-serif", fontWeight: 600, fontSize: 16.5, letterSpacing: ".02em", lineHeight: 1.4 }}>{q}</span>
            <span style={{ flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, color: "#7B3F9D", lineHeight: 1 }}>{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} style={{ padding: "0 18px 16px 46px", background: "#F6F4EF", borderTop: "1px solid #C9C2CE" }}>
              <p style={{ margin: "14px 0 0", maxWidth: "44em", fontSize: 14.5, lineHeight: 1.75, color: "#2A2333", textWrap: "pretty" }}>{a}</p>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
