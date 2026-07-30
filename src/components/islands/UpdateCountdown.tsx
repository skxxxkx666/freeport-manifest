import { useEffect, useState } from "react";
import { untilNextIssue } from "../../lib/waybill";

export default function UpdateCountdown() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    setT(untilNextIssue());
    const id = setInterval(() => setT(untilNextIssue()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    // 没有可访问名时读屏只会念出「03:11:57」,不知道这是什么的倒计时。
    <div role="timer" aria-label="距离下次签发" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--color-stamp)" }}>
      {t}
    </div>
  );
}
