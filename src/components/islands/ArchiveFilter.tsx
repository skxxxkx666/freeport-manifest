import { useMemo, useState } from "react";
import { monthLabel, monthOf, waybillNo } from "../../lib/waybill";

export interface Stub { date: string; serial: string; nodeCount: number; regions: string[]; current?: boolean; href: string; }

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "var(--color-rule)", border: "1px solid var(--color-rule)", width: "fit-content", margin: "0 20px 18px" }}>
        {["all", ...months].map((m) => (
          <button
            key={m}
            type="button"
            className="wb-tab"
            onClick={() => setMonth(m)}
            aria-pressed={month === m}
            style={{ appearance: "none", border: 0, background: month === m ? "var(--color-ink)" : "var(--color-copy-white)", color: month === m ? "var(--color-copy-white)" : "var(--color-ink-soft)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", padding: "9px 15px", cursor: "pointer" }}
          >
            {m === "all" ? "全部" : m}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.month}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "10px 20px", background: "var(--color-copy-blue-d)", borderBottom: "1px solid var(--color-rule)", borderTop: "1px solid var(--color-rule)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--color-ink)", textTransform: "uppercase" }}>
            <span>{monthLabel(g.month)}</span>
            <span style={{ color: "var(--color-ink-faint)" }}>{g.rows.length} 份</span>
          </div>
          {g.rows.map((s, i) => (
            <a
              key={s.date}
              href={s.href}
              className="wb-row"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 18px", borderBottom: "1px solid var(--color-rule)", background: i % 2 ? "rgba(251,250,247,.5)" : "transparent", color: "var(--color-ink)", padding: "11px 20px" }}
            >
              {/* 运单号是全系统最大的装置,存根索引里却缩到 14px 混在一行文字里。
                  升到 data-lg(19px),这一列才读得出「一摞存根」。 */}
              <span style={{ flex: "1 1 200px", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 19, letterSpacing: "-.01em" }}>{waybillNo(s.date, s.serial)}</span>
              {/* 固定列宽 —— 此前元数据是变宽的,每行起点都不同,整列右缘参差。
                  运单号放大后这个参差更刺眼,必须让周围安静下来。 */}
              <span style={{ flex: "0 0 96px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-ink-soft)", letterSpacing: ".04em" }}>{s.date}</span>
              <span style={{ flex: "0 0 68px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".04em" }}>{s.nodeCount} PCS</span>
              <span style={{ flex: "0 0 170px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-ink-soft)", letterSpacing: ".08em" }}>{s.regions.join(" ")}</span>
              {/* 「查看 →」是整行链接里唯一的行动指示,却用淡墨,实测 1.96–2.15:1。
                  它不是字段标签,不在 CLAUDE.md 的裁决范围内,改次墨。 */}
              <span style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--color-ink-soft)", textTransform: "uppercase" }}>
                {s.current ? "当前生效 →" : "查看 →"}
              </span>
            </a>
          ))}
        </div>
      ))}
    </>
  );
}
