import { getCollection, type CollectionEntry } from "astro:content";

export type Sub = CollectionEntry<"subs">;

/** 按日期倒序,最新在前 */
export async function allSubs(): Promise<Sub[]> {
  const subs = await getCollection("subs");
  return subs.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

/** 今日运单 = 最新一份未失效的 */
export async function latestSub(): Promise<Sub | undefined> {
  const subs = await allSubs();
  return subs.find((s) => !s.data.expired) ?? subs[0];
}

/** 校验位:加权模十 + 全和模十,纯装饰但可复算 */
export function checkCode(date: string, serial: string) {
  const c = date.replace(/-/g, "");
  const digits = (c + serial).split("").map(Number);
  const weighted = digits.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0);
  const plain = digits.reduce((t, n) => t + n, 0);
  return `${weighted % 10}·${c.slice(0, 4)} ${c.slice(4)} ${serial}·${plain % 10}`;
}

export const remarkOf = (d: Sub["data"]) =>
  [d.note, d.alive ? `存活率抽样 ${Math.round(d.alive * 100)}%` : ""].filter(Boolean).join("。");
