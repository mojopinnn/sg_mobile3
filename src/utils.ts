import { Project, Task, Version, Shot } from "./types";

export const STATUS_STYLE_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  wtg: { label: "대기 중", bg: "bg-stone-100", text: "text-stone-600", border: "border-stone-300" },
  ip: { label: "진행 중", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  rev: { label: "검토 요청", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  fin: { label: "완료", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  apr: { label: "승인됨", bg: "bg-emerald-50", text: "text-emerald-750", border: "border-emerald-200" },
  omt: { label: "생략", bg: "bg-stone-150", text: "text-stone-500", border: "border-stone-250" },
};

export function getStatusStyle(status: string) {
  const code = (status || "").toLowerCase().trim();
  if (["approved", "apr", "final", "fin", "complete"].includes(code)) return STATUS_STYLE_MAP.fin;
  if (["in_progress", "ip", "inprogress", "wip"].includes(code)) return STATUS_STYLE_MAP.ip;
  if (["pending_review", "rev", "review"].includes(code)) return STATUS_STYLE_MAP.rev;
  if (["waiting", "wtg", "ready", "ready to start"].includes(code)) return STATUS_STYLE_MAP.wtg;
  if (["omitted", "omt", "omit", "hld", "hold"].includes(code)) return STATUS_STYLE_MAP.omt;

  return { label: status ? status.toUpperCase() : "대기 중", bg: "bg-stone-100", text: "text-stone-700", border: "border-stone-300" };
}

export function cleanAssigneeName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    const suffixes = new Set([
      "comp", "fx", "mm", "matte", "roto", "remove", "lgt", "anim", "layout", "vfx", "paint", "matchmove"
    ]);
    if (suffixes.has(lastPart)) {
      return parts.slice(0, parts.length - 1).join(" ");
    }
  }
  return trimmed;
}
