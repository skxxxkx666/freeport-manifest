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
    <div role="timer" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, color: "#7B3F9D" }}>
      {t}
    </div>
  );
}
