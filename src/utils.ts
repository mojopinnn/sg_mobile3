import { Project, Task, Version, Shot } from "./types";

export const STATUS_STYLE_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  wtg: { label: "대기 중", bg: "bg-stone-100", text: "text-stone-600", border: "border-stone-300" },
  ip: { label: "진행 중", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  rev: { label: "검토 요청", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  fin: { label: "완료", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  apr: { label: "승인됨", bg: "bg-emerald-50", text: "text-emerald-750", border: "border-emerald-200" },
  omt: { label: "생략", bg: "bg-stone-150", text: "text-stone-500", border: "border-stone-250" },
};

// Absolute accurate ShotGrid studio statuses mapping from actual settings screenshots
export const SHOTGRID_REAL_STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  wtg: { label: "WTG", bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200" },
  rd: { label: "RD", bg: "bg-yellow-400", text: "text-neutral-900", border: "border-yellow-500" },
  wip: { label: "WIP", bg: "bg-lime-500", text: "text-neutral-900", border: "border-lime-600" },
  pus: { label: "PUS", bg: "bg-amber-500/80", text: "text-neutral-900 font-semibold", border: "border-amber-400" },
  tc: { label: "TC", bg: "bg-indigo-600", text: "text-white font-semibold", border: "border-indigo-700" },
  pc: { label: "PC", bg: "bg-indigo-500", text: "text-white font-semibold", border: "border-indigo-600" },
  cc: { label: "CC", bg: "bg-sky-400", text: "text-white font-semibold", border: "border-sky-500" },
  sc: { label: "SV", bg: "bg-blue-400", text: "text-white font-semibold", border: "border-blue-500" }, // Short Code is sc, Icon text is SV
  rv: { label: "RV", bg: "bg-yellow-400", text: "text-neutral-900 font-semibold", border: "border-yellow-500" },
  pub: { label: "Pub", bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  tpub: { label: "t-Pub", bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
  rt: { label: "RT", bg: "bg-orange-500", text: "text-white font-semibold", border: "border-orange-600" },
  kg: { label: "KG", bg: "bg-amber-500", text: "text-white font-semibold", border: "border-amber-600" },
  tfin: { label: "TFIN", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  fin: { label: "FIN", bg: "bg-emerald-600", text: "text-white font-semibold", border: "border-emerald-700" },
  ct: { label: "CT", bg: "bg-pink-600", text: "text-white font-semibold", border: "border-pink-700" },
  cts: { label: "CTS", bg: "bg-blue-600", text: "text-white font-semibold", border: "border-blue-700" },
  
  // Additional from screenshot list
  act: { label: "Active", bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
  apr: { label: "APR", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  clsd: { label: "CLSD", bg: "bg-neutral-200", text: "text-neutral-700", border: "border-neutral-300" },
  res: { label: "RES", bg: "bg-neutral-200", text: "text-neutral-700", border: "border-neutral-300" },
  vwd: { label: "Viewed", bg: "bg-neutral-200", text: "text-neutral-700", border: "border-neutral-300" },
  cmpt: { label: "CMPT", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  dlvr: { label: "DLVR", bg: "bg-neutral-200", text: "text-neutral-700", border: "border-neutral-300" },
  dis: { label: "DIS", bg: "bg-blue-600", text: "text-white font-semibold", border: "border-blue-700" },
  qc: { label: "QC", bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
  cfrm: { label: "CFRM", bg: "bg-sky-100", text: "text-sky-850", border: "border-sky-200" },
  pndng: { label: "PNDNG", bg: "bg-neutral-200", text: "text-neutral-700", border: "border-neutral-300" },
  na: { label: "na", bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-300" },
  no: { label: "no", bg: "bg-stone-500", text: "text-white font-semibold", border: "border-stone-600" },
  cto: { label: "CTO", bg: "bg-purple-200", text: "text-purple-850", border: "border-purple-300" },
  ctr: { label: "CTR", bg: "bg-red-600", text: "text-white font-semibold", border: "border-red-700" },
  ctp: { label: "CTP", bg: "bg-teal-500", text: "text-white font-semibold", border: "border-teal-600" },
  drt: { label: "DRT", bg: "bg-red-600", text: "text-white font-semibold", border: "border-red-700" },
  dok: { label: "DOK", bg: "bg-emerald-100", text: "text-emerald-800 font-semibold", border: "border-emerald-300" },
  dr: { label: "DR", bg: "bg-red-600", text: "text-white font-semibold", border: "border-red-700" },
  edc: { label: "EDC", bg: "bg-orange-400", text: "text-white font-semibold", border: "border-orange-500" },
  ip: { label: "IP", bg: "bg-emerald-600", text: "text-white font-semibold", border: "border-emerald-700" },
  "di-sen": { label: "DIS", bg: "bg-yellow-500", text: "text-neutral-900 font-semibold", border: "border-yellow-600" },
  sr: { label: "SR", bg: "bg-red-600", text: "text-white font-semibold", border: "border-red-700" },
  dv: { label: "DV", bg: "bg-purple-600", text: "text-white font-semibold", border: "border-purple-700" },
  omt: { label: "OMT", bg: "bg-neutral-400", text: "text-white font-semibold", border: "border-neutral-500" },
  hld: { label: "HLD", bg: "bg-neutral-500", text: "text-white font-semibold", border: "border-neutral-600" },
  opn: { label: "OPN", bg: "bg-neutral-200", text: "text-neutral-800", border: "border-neutral-300" },
  rev: { label: "REV", bg: "bg-purple-600", text: "text-white font-semibold", border: "border-purple-700" },
  recd: { label: "RECD", bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
  cfm: { label: "CFM", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
};

export function getStatusStyle(status: string) {
  const code = (status || "").toLowerCase().trim();
  
  // Try exact lookup from ShotGrid real statuses map first
  if (SHOTGRID_REAL_STATUS_MAP[code]) {
    return SHOTGRID_REAL_STATUS_MAP[code];
  }

  // Graceful fallback for old/historical status codes
  if (["approved", "apr", "final", "complete", "cmpt", "res", "delivered", "dlvr", "cto", "dok", "di-sen", "dv", "y"].includes(code)) {
    return SHOTGRID_REAL_STATUS_MAP.fin;
  }
  if (["pending_review", "rev", "review", "ctp", "pndng", "vwd", "qc", "recd", "cfm", "cfrm"].includes(code)) {
    return SHOTGRID_REAL_STATUS_MAP.rev;
  }
  if (["in_progress", "inprogress", "ip", "act", "active", "keep going", "ctr", "client retake", "dr", "director retake", "sr", "supervisor retake", "drt", "delivery retake", "edc", "edit change"].includes(code)) {
    return SHOTGRID_REAL_STATUS_MAP.wip;
  }
  if (["waiting", "ready", "ready to start", "opn", "open"].includes(code)) {
    return SHOTGRID_REAL_STATUS_MAP.wtg;
  }
  if (["omitted", "omt", "omit", "hld", "hold", "clsd", "closed", "dis", "disabled", "no", "no cg", "pause"].includes(code)) {
    return { label: status ? status.toUpperCase() : "OMT", bg: "bg-stone-200", text: "text-stone-600", border: "border-stone-300" };
  }

  return { label: status ? status.toUpperCase() : "WTG", bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200" };
}

export function cleanAssigneeName(name: string): string {
  if (!name) return "";
  const partsList = name.split(",").map((item) => {
    const trimmedItem = item.trim();
    const words = trimmedItem.split(/\s+/);
    if (words.length > 1) {
      const lastWord = words[words.length - 1];
      const preceding = words.slice(0, words.length - 1).join(" ");
      const isPrecedingKorean = /[\uac00-\ud7a3]/.test(preceding);
      const isLastWordEnglishWithNums = /^[a-zA-Z0-9]+$/.test(lastWord);
      
      const knownSuffixes = new Set([
        "comp", "fx", "mm", "matte", "roto", "remove", "lgt", "anim", "layout", "vfx", "paint", "matchmove",
        "ani", "asset", "cfx", "model", "modeling", "motion"
      ]);
      const lastWordLower = lastWord.toLowerCase();
      
      if ((isPrecedingKorean && isLastWordEnglishWithNums) || knownSuffixes.has(lastWordLower)) {
        return preceding;
      }
    }
    return trimmedItem;
  });
  return partsList.join(", ");
}

export function getVersionVideoUrl(version: any): string {
  if (!version) return "";
  
  // 1. Mobile & Web optimized MP4 Proxy stream URL (Priority)
  if (version.sg_uploaded_movie_mp4) {
    if (typeof version.sg_uploaded_movie_mp4 === "string") {
      return version.sg_uploaded_movie_mp4;
    }
    if (typeof version.sg_uploaded_movie_mp4 === "object" && version.sg_uploaded_movie_mp4.url) {
      return version.sg_uploaded_movie_mp4.url;
    }
  }

  // 2. High-res or uploaded movie attachment URL (Secondary fallback)
  if (version.sg_uploaded_movie) {
    if (typeof version.sg_uploaded_movie === "string") {
      return version.sg_uploaded_movie;
    }
    if (typeof version.sg_uploaded_movie === "object" && version.sg_uploaded_movie.url) {
      return version.sg_uploaded_movie.url;
    }
  }

  // Fallbacks for Mock db IDs using robust CORS-unrestricted Google video CDN samples
  if (version.id === 101) {
    return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
  }
  if (version.id === 102) {
    return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  }

  return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
}
