// 运单号、路径、格式化 —— 纯函数,岛与静态组件共用。

export const waybillNo = (date: string, serial = "01") =>
  `FP-${date.replace(/-/g, "")}-${serial}`;

export const url = (p: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;

/** 站内页面统一使用目录式尾斜杠，避免生产环境先 301 再进入页面。 */
export const pageUrl = (p: string) =>
  url(p ? `${p.replace(/^\//, "").replace(/\/$/, "")}/` : "");

export const monthOf = (date: string) => date.slice(0, 7);

export const monthLabel = (m: string) => `${m.slice(0, 4)} 年 ${m.slice(5)} 月`;

const chinaParts = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value.slice(0, 10), time: value.slice(11, 16) };
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map(({ type, value: part }) => [type, part])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
};

export const chinaTime = (value: string) => chinaParts(value).time;

export const chinaDateTime = (value: string) => {
  const parts = chinaParts(value);
  return `${parts.date} ${parts.time}`;
};

/** 移动端订阅链接中段截断 */
export const truncateUrl = (u: string, head = 34, tail = 12) =>
  u.length <= head + tail ? u : `${u.slice(0, head)}…${u.slice(-tail)}`;

/** 下次签发(每日 04:17 / 16:17 UTC+8)剩余时间 */
export function untilNextIssue(now = new Date()) {
  const next = new Date(now);
  const nextUtcHour = [8, 20].find((hour) => {
    const candidate = new Date(now);
    candidate.setUTCHours(hour, 17, 0, 0);
    return candidate.getTime() > now.getTime();
  });
  if (nextUtcHour === undefined) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(8, 17, 0, 0);
  } else {
    next.setUTCHours(nextUtcHour, 17, 0, 0);
  }
  const ms = next.getTime() - now.getTime();
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

export const deepLinks = (kind: "clash" | "v2ray", sub: string) => {
  const e = encodeURIComponent(sub);
  return kind === "clash"
    ? [
        { client: "CLASH VERGE", href: `clash://install-config?url=${e}` },
        { client: "CLASH META", href: `clashmeta://install-config?url=${e}` }
      ]
    : [
        { client: "V2RAYN", href: `sub://${e}` },
        { client: "SHADOWROCKET", href: `shadowrocket://add/sub://${e}` }
      ];
};
