import { useMemo, useState } from "react";
import { monthLabel, monthOf, waybillNo } from "../../lib/waybill";

export interface Stub { date: string; serial: string; nodeCount: number; regions: string[]; href: string; }

export default function ArchiveFilter({ stubs }: { stubs: Stub[] }) {
  const [month, setMonth] = useState("all");

  const months = useMemo(() => {
    const seen: string[] = [];
    for (const s of stubs) { const m = monthOf(s.date); if (!seen.includes(m)) seen.push(m); }
    return seen;
  }, [stubs]);

  const groups = useMemo(() => {
    const shown = month === "all" ? stubs : stubs.filter((s) => monthOf(s.date) === month);
    return months
      .map((m) => ({ month: m, rows: shown.filter((s) => monthOf(s.date) === m) }))
      .filter((g) => g.rows.length > 0);
  }, [stubs, months, month]);

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "#C9C2CE", border: "1px solid #C9C2CE", width: "fit-content", margin: "0 20px 18px" }}>
        {["all", ...months].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonth(m)}
            aria-pressed={month === m}
            style={{ appearance: "none", border: 0, background: month === m ? "#2A2333" : "#FBFAF7", color: month === m ? "#FBFAF7" : "#6B6478", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: ".12em", padding: "9px 15px", cursor: "pointer" }}
          >
            {m === "all" ? "全部" : m}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.month}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "10px 20px", background: "#D3DEEC", borderBottom: "1px solid #C9C2CE", borderTop: "1px solid #C9C2CE", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#6B6478", textTransform: "uppercase" }}>
            <span>{monthLabel(g.month)}</span>
            <span style={{ color: "#A9A3B2" }}>{g.rows.length} 份</span>
          </div>
          {g.rows.map((s, i) => (
            <a
              key={s.date}
              href={s.href}
              style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 18px", borderBottom: "1px solid #C9C2CE", background: i % 2 ? "rgba(251,250,247,.5)" : "transparent", color: "#2A2333", padding: "11px 20px" }}
            >
              <span style={{ flex: "1 1 170px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, letterSpacing: "-.01em" }}>{waybillNo(s.date, s.serial)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#6B6478", letterSpacing: ".04em" }}>{s.date}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".04em" }}>{s.nodeCount} PCS</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#6B6478", letterSpacing: ".08em" }}>{s.regions.join(" ")}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A9A3B2", textTransform: "uppercase" }}>查看 →</span>
            </a>
          ))}
        </div>
      ))}
    </>
  );
}
