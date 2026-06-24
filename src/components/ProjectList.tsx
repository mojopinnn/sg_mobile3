import React, { useEffect, useState } from "react";
import { Project } from "../types";
import { FolderKanban, Loader2, BarChart2, ClipboardList, CalendarRange, Film, X, PlayCircle, ImageIcon, Brain, ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { getStatusStyle, getVersionVideoUrl } from "../utils";

interface ProjectListProps {
  onNavigate: (view: string, params?: any) => void;
}

export default function ProjectList({ onNavigate }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Report States
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // D-Day States
  const [showDday, setShowDday] = useState(false);
  const [ddayData, setDdayData] = useState<any[]>([]);
  const [ddayLoading, setDdayLoading] = useState(false);
  const [ddayError, setDdayError] = useState<string | null>(null);
  const [ddayStatusFilter, setDdayStatusFilter] = useState<string[]>([]);

  // Expanded Shot versions in D-day
  const [ddayExpandedShotId, setDdayExpandedShotId] = useState<number | null>(null);
  const [ddayShotVersions, setDdayShotVersions] = useState<Record<number, any[]>>({});
  const [ddayVersionsLoading, setDdayVersionsLoading] = useState<Record<number, boolean>>({});

  // Active Video overlay player inside ProjectList
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  // Status-based Version Viewer States
  const [selectedStatusProject, setSelectedStatusProject] = useState<{ id: number; name: string; code?: string } | null>(null);
  const [selectedStatusCategory, setSelectedStatusCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [statusVersions, setStatusVersions] = useState<any[]>([]);
  const [statusShots, setStatusShots] = useState<any[]>([]);
  const [modalExpandedShotId, setModalExpandedShotId] = useState<number | null>(null);
  const [statusVersionsLoading, setStatusVersionsLoading] = useState<boolean>(false);
  const [statusVersionsError, setStatusVersionsError] = useState<string | null>(null);

  const handleStatusClick = (projectId: number, projectName: string, projectCode: string, category: string, status: string) => {
    setSelectedStatusProject({ id: projectId, name: projectName, code: projectCode });
    setSelectedStatusCategory(category);
    setSelectedStatus(status);
    setStatusVersionsLoading(true);
    setStatusVersionsError(null);
    setStatusVersions([]);
    setStatusShots([]);
    setModalExpandedShotId(null);

    const targetStatus = status.toLowerCase();
    const cat = category.toUpperCase();

    Promise.all([
      fetch(`/api/project/${projectId}/shots`).then((res) => {
        if (!res.ok) throw new Error("샷 데이터를 가져오는 데 실패했습니다.");
        return res.json();
      }),
      fetch(`/api/project/${projectId}/versions`).then((res) => {
        if (!res.ok) throw new Error("버전 데이터를 가져오는 데 실패했습니다.");
        return res.json();
      }),
      fetch(`/api/tasks?project_id=${projectId}`).then((res) => {
        if (!res.ok) throw new Error("태스크 데이터를 가져오는 데 실패했습니다.");
        return res.json();
      })
    ])
      .then(([shots, versions, tasks]) => {
        const shotsArr = Array.isArray(shots) ? shots : [];
        const versionsArr = Array.isArray(versions) ? versions : [];
        const tasksArr = Array.isArray(tasks) ? tasks : [];

        // 1. Find matching tasks for this project that match the category (COMP or MATTE) and standard status
        const matchingTasks = tasksArr.filter((t: any) => {
          const taskStdStatus = normalizeToStandardStatus(t.sg_status_list);
          if (taskStdStatus !== targetStatus) return false;

          const stepName = (t.sg_task || (t.step && typeof t.step === "object" ? t.step.name : t.step) || t.content || "").toLowerCase();
          if (cat === "COMP") {
            return stepName.includes("comp") || stepName.includes("composite") || stepName.includes("compositing");
          } else if (cat === "MATTE") {
            return stepName.includes("matte") || stepName.includes("dmp") || stepName.includes("painting");
          }
          return false;
        });

        const matchingTaskIds = new Set(matchingTasks.map((t: any) => t.id));

        // Find match shot IDs based on either matching task OR matching version
        const matchingShotIds = new Set<number>();
        matchingTasks.forEach((t: any) => {
          if (t.entity && t.entity.id) {
            matchingShotIds.add(t.entity.id);
          }
        });

        // 2. Filter versions to identify if they correspond to matching shot/tasks
        const matchingVersions = versionsArr.filter((v: any) => {
          if (v.sg_task && typeof v.sg_task === "object" && v.sg_task.id) {
            return matchingTaskIds.has(v.sg_task.id);
          }
          if (v.entity && typeof v.entity === "object" && v.entity.id) {
            const hasMatchingShotTask = matchingTasks.some((t: any) => t.entity && t.entity.id === v.entity.id);
            if (hasMatchingShotTask) {
              const codeLower = (v.code || "").toLowerCase();
              const descLower = (v.description || "").toLowerCase();
              if (cat === "COMP") {
                return codeLower.includes("comp") || codeLower.includes("composite") || codeLower.includes("compositing") ||
                       descLower.includes("comp") || descLower.includes("composite") || descLower.includes("compositing");
              } else if (cat === "MATTE") {
                return codeLower.includes("matte") || codeLower.includes("dmp") || codeLower.includes("painting") ||
                       descLower.includes("matte") || descLower.includes("dmp") || descLower.includes("painting");
              }
            }
          }
          return false;
        });

        matchingVersions.forEach((v: any) => {
          if (v.entity && v.entity.id) {
            matchingShotIds.add(v.entity.id);
          }
        });

        // Filter the shots of the project that are in matchingShotIds
        const filteredShots = shotsArr.filter((s: any) => matchingShotIds.has(s.id));
        const sortedShots = filteredShots.sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));

        setStatusShots(sortedShots);
        setStatusVersions(versionsArr); // Keep all project versions to filter per-shot in detail view
        setStatusVersionsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading status versions:", err);
        setStatusVersionsError(err.message || "데이터를 가져오는 중 오류가 발생했습니다.");
        setStatusVersionsLoading(false);
      });
  };

  const handleOpenReport = () => {
    setShowReport(true);
    setReportLoading(true);
    setReportError(null);
    fetch("/api/report-stats")
      .then((res) => {
        if (!res.ok) throw new Error("보고서 데이터를 가져오는 데 실패했습니다.");
        return res.json();
      })
      .then((data) => {
        setReportData(data);
        setReportLoading(false);
      })
      .catch((err) => {
        console.error("Error loading report stats:", err);
        setReportError(err.message || "보고서 데이터를 가져오는 중 오류가 발생했습니다.");
        setReportLoading(false);
      });
  };

  const handleOpenDday = () => {
    setShowDday(true);
    setDdayLoading(true);
    setDdayError(null);
    setDdayStatusFilter([]);

    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    const adjusted = new Date(todayLocal.getTime() - (offset * 60000));
    const todayStr = adjusted.toISOString().split("T")[0];

    fetch(`/api/dday-tasks?today=${todayStr}`)
      .then((res) => {
        if (!res.ok) throw new Error("D-day 데이터를 가져오는 데 실패했습니다.");
        return res.json();
      })
      .then((data) => {
        setDdayData(data);
        setDdayLoading(false);
      })
      .catch((err) => {
        console.error("Error loading dday stats:", err);
        setDdayError(err.message || "D-day 데이터를 가져오는 중 오류가 발생했습니다.");
        setDdayLoading(false);
      });
  };

  const loadProjects = () => {
    setLoading(true);
    setErrorMsg(null);
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.error) {
          setErrorMsg(data.error);
        } else if (!Array.isArray(data)) {
          setErrorMsg("올바르지 않은 응답 형식입니다. 데이터 목록이 비어있거나 가져올 수 없습니다.");
        } else {
          setProjects(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading projects:", err);
        setErrorMsg(err.message || "서버 통신 오류가 발생했습니다.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleToggleMockEmergency = () => {
    setLoading(true);
    fetch("/api/settings/toggle_mock", {
      method: "POST"
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          loadProjects();
        } else {
          setErrorMsg(data.error || "데모 모드로의 전환에 실패했습니다.");
          setLoading(false);
        }
      })
      .catch((err) => {
        setErrorMsg("서버 통신 중 오류가 발생했습니다.");
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase">프로젝트를 불러오는 중...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border border-rose-200 rounded-3xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-600 rounded-full mb-3">
            <span className="text-xl font-bold">!</span>
          </div>
          <h2 className="text-base font-black text-stone-900">실제 Shotgrid 서버 연동 실패</h2>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            인프라 설정에 등록된 자격 증명 정보가 올바르지 않거나, 서버 연결이 거부되었습니다.
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl mb-5">
          <p className="text-[11px] font-bold text-rose-800 font-mono break-all text-center">
            {errorMsg}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleToggleMockEmergency}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
          >
            기능 체험을 위해 [데모 모드]로 즉시 전환
          </button>
          <button
            onClick={() => onNavigate("settings")}
            className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-black text-xs uppercase tracking-wider transition cursor-pointer"
          >
            연동 자격 증명 설정하러 이동하기
          </button>
        </div>
      </div>
    );
  }

  // Dynamic collection of all unique statuses in the original ddayData
  const availableDdayStatuses = Array.from(
    new Set(
      ddayData.flatMap((p) => (p.tasks || []).map((t: any) => (t.status || "").toLowerCase().trim()))
    )
  ).filter(Boolean) as string[];

  const filteredDdayData = ddayData.map((projectReport) => {
    const filteredTasks = (projectReport.tasks || []).filter((task: any) => {
      if (ddayStatusFilter.length === 0) return true;
      return ddayStatusFilter.includes((task.status || "").toLowerCase().trim());
    });
    return {
      ...projectReport,
      tasks: filteredTasks,
    };
  }).filter((p) => p.tasks.length > 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Active Productions</p>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-0.5">PROJECTS</h1>
        </div>
        
        {/* Buttons in Top Right */}
        <div className="flex items-center space-x-2">
          {/* D-Day Button */}
          <button
            onClick={handleOpenDday}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 hover:border-stone-400 shadow-sm text-xs font-black tracking-tight cursor-pointer transition active:scale-95"
          >
            <CalendarRange className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
            <span>D-DAY</span>
          </button>

          {/* Report Button */}
          <button
            onClick={handleOpenReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 hover:border-stone-400 shadow-sm text-xs font-black tracking-tight cursor-pointer transition active:scale-95"
          >
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
            <span>REPORT</span>
          </button>
        </div>
      </div>

      {/* Project Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {projects.map((proj) => (
          <button
            key={proj.id}
            onClick={() => onNavigate("project_detail", { projectId: proj.id })}
            className="w-full text-left bg-white border border-stone-200 rounded-3xl overflow-hidden hover:border-stone-400 transition flex flex-col justify-between shadow-sm cursor-pointer"
          >
            {/* Card Header */}
            <div className="pt-2.5 px-4.5 pb-3 border-b border-stone-150 bg-stone-50/50 w-full">
              {proj.code && (
                <div className="text-[13px] text-stone-400 font-mono tracking-wider mb-1">{proj.code}</div>
              )}
              <div className="flex justify-between items-center gap-1.5">
                <h2 className="text-[22px] font-black text-stone-900 flex items-center flex-wrap gap-x-2 leading-tight">
                  <span className="truncate">{proj.name}</span>
                  {proj.comp_last_due_date && (
                    <span className="text-[13px] text-amber-850 font-black tracking-tight bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">
                      comp last due date: {proj.comp_last_due_date}
                    </span>
                  )}
                  <span className="text-base font-bold text-stone-600 font-mono inline-flex items-center bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200">
                    <span className="text-stone-700">{proj.active_shots_count ?? 0}</span>
                    <span className="text-[13px] text-stone-400 font-medium ml-1">
                      ({proj.total_shots_count ?? 0})
                    </span>
                  </span>
                </h2>
              </div>
            </div>
            
            {/* Card Body */}
            <div className="p-4 bg-white flex-1 flex flex-col justify-between w-full space-y-4">
              {/* Total Progress Bars */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] font-black text-stone-500 uppercase tracking-widest flex items-center">
                    <BarChart2 className="w-4 h-4 text-blue-500 mr-1.5" /> COMP PROGRESS
                  </span>
                  <div className="flex items-baseline space-x-1.5 font-sans">
                    <span className={`text-[22px] font-black leading-none ${proj.sg_sub_status_gray ? "text-stone-500" : "text-blue-600"}`}>
                      {proj.progress_1 ?? 0}%
                    </span>
                    <span className={`text-[18px] font-extrabold leading-none ${proj.sg_sub_status_gray ? "text-stone-400" : "text-indigo-500/70"}`}>
                      {proj.progress_2 ?? 0}%
                    </span>
                    <span className={`text-[14.5px] font-semibold leading-none ${proj.sg_sub_status_gray ? "text-stone-400/80" : "text-indigo-500/58"}`}>
                      {proj.progress_3 ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Layered Bar presentation */}
                <div className="relative w-full bg-stone-100 rounded-full h-4 overflow-hidden border border-stone-150 p-[1px]">
                  {/* Layer 3: lowest opacity (progress_3) */}
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${proj.progress_3}%` }}
                    transition={{ duration: 0.5 }}
                    className={`absolute top-0 left-0 h-full rounded-full ${proj.sg_sub_status_gray ? "bg-stone-350/40" : "bg-indigo-500/20"}`}
                  ></motion.div>
                  {/* Layer 2: medium opacity (progress_2) */}
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${proj.progress_2}%` }}
                    transition={{ duration: 0.5 }}
                    className={`absolute top-0 left-0 h-full rounded-full ${proj.sg_sub_status_gray ? "bg-stone-400/50" : "bg-indigo-500/50"}`}
                  ></motion.div>
                  {/* Layer 1: solid core (progress_1) */}
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${proj.progress_1}%` }}
                    transition={{ duration: 0.6 }}
                    className={`absolute top-0 left-0 h-full rounded-full ${proj.sg_sub_status_gray ? "bg-stone-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`}
                  ></motion.div>
                </div>
              </div>

              {/* Matte, Lgt, FX statistics */}
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-stone-100">
                {/* Matte */}
                <div className="flex items-center bg-stone-50/50 px-2 py-0.5 rounded-lg border border-stone-100 text-[13px]">
                  <span className="font-extrabold text-stone-400 text-[11px] tracking-wider mr-1.5">MATTE</span>
                  <span className="font-mono text-stone-700 font-bold">
                    <span className="text-emerald-600 font-extrabold">{proj.matte_stats?.fin || 0}</span>/{proj.matte_stats?.total || 0} <span className="text-[10px] text-stone-400 font-bold uppercase font-sans">fin</span>
                  </span>
                  {!!proj.matte_stats?.tpub && (
                    <>
                      <span className="text-stone-300 text-[11px] mx-1 font-mono">|</span>
                      <span className="font-mono text-stone-700 font-bold">
                        <span className="text-amber-600 font-extrabold">{proj.matte_stats.tpub}</span> <span className="text-[10px] text-stone-450 font-bold uppercase font-sans">t-pub</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Lgt */}
                <div className="flex items-center bg-stone-50/50 px-2 py-0.5 rounded-lg border border-stone-100 text-[13px]">
                  <span className="font-extrabold text-stone-400 text-[11px] tracking-wider mr-1.5">LGT</span>
                  <span className="font-mono text-stone-700 font-bold">
                    <span className="text-emerald-600 font-extrabold">{proj.lgt_stats?.fin || 0}</span>/{proj.lgt_stats?.total || 0} <span className="text-[10px] text-stone-400 font-bold uppercase font-sans">fin</span>
                  </span>
                  {!!proj.lgt_stats?.tpub && (
                    <>
                      <span className="text-stone-300 text-[11px] mx-1 font-mono">|</span>
                      <span className="font-mono text-stone-700 font-bold">
                        <span className="text-amber-600 font-extrabold">{proj.lgt_stats.tpub}</span> <span className="text-[10px] text-stone-450 font-bold uppercase font-sans">t-pub</span>
                      </span>
                    </>
                  )}
                </div>

                {/* FX */}
                <div className="flex items-center bg-stone-50/50 px-2 py-0.5 rounded-lg border border-stone-100 text-[13px]">
                  <span className="font-extrabold text-stone-400 text-[11px] tracking-wider mr-1.5">FX</span>
                  <span className="font-mono text-stone-700 font-bold">
                    <span className="text-emerald-600 font-extrabold">{proj.fx_stats?.fin || 0}</span>/{proj.fx_stats?.total || 0} <span className="text-[10px] text-stone-400 font-bold uppercase font-sans">fin</span>
                  </span>
                  {!!proj.fx_stats?.tpub && (
                    <>
                      <span className="text-stone-300 text-[11px] mx-1 font-mono">|</span>
                      <span className="font-mono text-stone-700 font-bold">
                        <span className="text-amber-600 font-extrabold">{proj.fx_stats.tpub}</span> <span className="text-[10px] text-stone-450 font-bold uppercase font-sans">t-pub</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full bg-white border border-stone-200 rounded-3xl p-10 text-center text-stone-500 shadow-sm">
            <FolderKanban className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-base font-semibold">활성화된 프로젝트 데이터가 없거나 모두 완료되었습니다.</p>
          </div>
        )}
      </div>

      {/* Report Modal - Full Screen */}
      {showReport && (
        <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-white py-1 px-4 border-b border-stone-150 flex items-center justify-between shadow-3xs">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className="p-1 bg-blue-50/50 text-blue-600 rounded-lg border border-blue-100/30 shadow-3xs">
                    <ClipboardList className="w-3 h-3 flex-shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-[8px] md:text-[10px] font-black text-stone-900 leading-none uppercase tracking-wider">report</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-1 md:p-1.5 rounded-lg border border-stone-150 hover:bg-stone-150/60 cursor-pointer text-stone-500 hover:text-stone-850 transition shadow-3xs flex items-center justify-center bg-white"
                >
                  <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-stone-50/60">
              <div className="max-w-5xl mx-auto w-full px-5 py-2 md:py-3 space-y-3">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
                    <p className="text-[12px] md:text-sm text-stone-450 font-extrabold uppercase tracking-widest animate-pulse">보고서 데이터를 집계 중입니다...</p>
                  </div>
                ) : reportError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-sm text-rose-800 font-medium">
                    {reportError}
                  </div>
                ) : reportData.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 text-sm font-semibold">
                    진행 중인 활성 프로젝트가 존재하지 않습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportData.map((projectReport) => (
                      <div key={projectReport.id} className="bg-transparent py-4 border-b border-stone-200 last:border-b-0 space-y-3.5">
                        {/* Project Meta Head */}
                        <div className="flex items-center justify-between gap-2 p-3 md:p-4 bg-stone-100 border border-stone-200 rounded-2xl shadow-3xs">
                          <div>
                            {projectReport.code && (
                              <span className="text-[10px] md:text-[11px] text-stone-500 font-mono tracking-wider uppercase font-extrabold block leading-none mb-1">{projectReport.code}</span>
                            )}
                            <h3 className="text-3xl md:text-[45px] font-black text-stone-900 leading-tight">{projectReport.name}</h3>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            {/* Total Shots Badging without film icon */}
                            <div className="flex items-center bg-blue-50 text-blue-700 font-black text-xs md:text-sm tracking-tight px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-3xs">
                              <span>총 샷 수: <span className="font-mono text-sm md:text-base font-black ml-1">{projectReport.total_shots}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Comp / Matte details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
                          {/* COMP Tasks List */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center pb-1 border-b border-stone-150">
                              <span className="text-sm md:text-base font-black text-stone-850 tracking-wide">COMP</span>
                            </div>
                            {renderStatusCounts(projectReport.id, projectReport.name, projectReport.code || "", "COMP", projectReport.comp_tasks_by_status, handleStatusClick)}
                          </div>

                          {/* MATTE Tasks List */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center pb-1 border-b border-stone-150">
                              <span className="text-sm md:text-base font-black text-stone-850 tracking-wide">MATTE</span>
                            </div>
                            {renderStatusCounts(projectReport.id, projectReport.name, projectReport.code || "", "MATTE", projectReport.matte_tasks_by_status, handleStatusClick)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white py-2.5 px-4 border-t border-stone-150 flex justify-end shadow-sm">
              <div className="max-w-5xl mx-auto w-full flex justify-end">
                <button
                  onClick={() => setShowReport(false)}
                  className="px-7 py-3 bg-stone-900 hover:bg-stone-850 text-white font-black text-sm uppercase tracking-wider rounded-2xl cursor-pointer transition shadow-md"
                >
                  닫기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Versions by Status Modal */}
      {selectedStatusProject && (
        <div className="fixed inset-0 z-[100] bg-stone-50 flex flex-col overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-white py-2.5 px-5 border-b border-stone-200 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-stone-500 font-mono tracking-wider uppercase font-extrabold px-2 py-0.5 bg-stone-100 rounded-md border border-stone-200">
                  {selectedStatusProject.code || "VFX"} &gt; {selectedStatusCategory}
                </span>
                <h2 className="text-sm md:text-base font-black text-stone-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <span>{selectedStatusProject.name}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] md:text-[11px] font-black tracking-wider uppercase leading-none border ${getStatusStyle(selectedStatus).bg} ${getStatusStyle(selectedStatus).text} ${getStatusStyle(selectedStatus).border}`}>
                    {getStatusStyle(selectedStatus).label}
                  </span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedStatusProject(null)}
                className="p-1.5 rounded-xl border border-stone-250 hover:bg-stone-100 cursor-pointer text-stone-500 hover:text-stone-800 transition shadow-3xs flex items-center justify-center bg-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-stone-50/50">
              <div className="w-full space-y-3">
                {statusVersionsLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-xs md:text-sm text-stone-450 font-extrabold uppercase tracking-widest animate-pulse">데이터를 불러오고 있습니다...</p>
                  </div>
                ) : statusVersionsError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-sm text-rose-800 font-medium">
                    {statusVersionsError}
                  </div>
                ) : statusShots.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 text-sm font-semibold border border-dashed border-stone-200 bg-white rounded-3xl">
                    이 상태에 해당하는 등록된 샷이 존재하지 않습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statusShots.map((shot) => {
                      const shotVersions = statusVersions.filter(v => {
                        if (!v.entity) {
                          const vCode = (v.code || "").toLowerCase();
                          const sCode = (shot.code || "").toLowerCase();
                          return sCode && (vCode.includes(sCode) || sCode.includes(vCode));
                        }
                        if (v.entity.id === shot.id) return true;
                        if (v.entity.name === shot.code) return true;
                        const ventName = (v.entity.name || "").toLowerCase();
                        const sCode = (shot.code || "").toLowerCase();
                        if (ventName && sCode && (ventName.includes(sCode) || sCode.includes(ventName))) return true;
                        const vCode = (v.code || "").toLowerCase();
                        if (vCode && sCode && (vCode.includes(sCode) || sCode.includes(vCode))) return true;
                        return false;
                      });

                      const isExpanded = modalExpandedShotId === shot.id;
                      const shotStatusKey = shot.sg_status_list || "wtg";
                      const shotStatusStyle = getStatusStyle(shotStatusKey);

                      return (
                        <div 
                          key={shot.id} 
                          className="bg-white border border-stone-200 rounded-xl p-3 md:p-4 shadow-3xs hover:border-stone-300 transition flex flex-col space-y-3"
                        >
                          {/* Shot Summary Card Area */}
                          <div 
                            onClick={() => setModalExpandedShotId(isExpanded ? null : shot.id)}
                            className="flex items-center gap-4 cursor-pointer select-none group/shot"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                              {/* Thumbnail with visual hint for clicking */}
                              <div className="w-[84px] h-[54px] md:w-24 md:h-[66px] bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner relative group-hover/shot:border-indigo-400 group-hover/shot:ring-2 group-hover/shot:ring-indigo-100 transition">
                                {shot.sg_org_thumbnail ? (
                                  <img
                                    src={shot.sg_org_thumbnail}
                                    alt={shot.code}
                                    className="object-cover w-full h-full"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : shot.image ? (
                                  <img
                                    src={shot.image}
                                    alt={shot.code}
                                    className="object-cover w-full h-full"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-stone-300" />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover/shot:bg-black/10 flex items-center justify-center transition">
                                  <PlayCircle className="w-5 h-5 text-white/0 group-hover/shot:text-white/80 drop-shadow-sm transition" />
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <h3 className="text-xs md:text-sm font-black text-stone-850 tracking-wider flex items-center space-x-2">
                                  <span className="group-hover/shot:text-indigo-600 transition">{shot.code}</span>
                                  <span className={`px-1.5 py-0.5 rounded-md text-[8px] md:text-[9px] font-black uppercase tracking-wider border ${shotStatusStyle.bg} ${shotStatusStyle.text} ${shotStatusStyle.border}`}>
                                    {shotStatusStyle.label}
                                  </span>
                                </h3>
                                <p className="text-[10px] text-stone-400 mt-0.5 truncate max-w-lg">
                                  {shot.description || "등록된 설명이 없습니다."}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Shot's Versions Accordion Area */}
                          {isExpanded && (
                            <div className="border-t border-stone-100 pt-3 mt-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest flex items-center">
                                  <Film className="w-3 h-3 text-indigo-500 mr-1" /> 이 샷의 버전 목록
                                </span>
                              </div>

                              {shotVersions.length === 0 ? (
                                <p className="text-[10px] text-stone-400 font-bold italic text-center py-4 bg-stone-50 rounded-xl border border-stone-150 border-dashed">
                                  하위에 등록된 영상 버전이 없습니다.
                                </p>
                              ) : (
                                <div className="flex flex-col space-y-1.5">
                                  {shotVersions.map((ver) => {
                                    const verStatusKey = ver.sg_status_list || "wip";
                                    const verStatusStyle = getStatusStyle(verStatusKey);
                                    return (
                                      <div 
                                        key={ver.id}
                                        onClick={async () => {
                                          try {
                                            setActiveVideoTitle(`${ver.code} 로딩 중...`);
                                            const res = await fetch(`/api/version/${ver.id}`);
                                            if (!res.ok) throw new Error("로드 실패");
                                            const freshVer = await res.json();
                                            const url = getVersionVideoUrl(freshVer);
                                            setActiveVideoUrl(url);
                                            setActiveVideoTitle(`${selectedStatusProject.name} (Selected: ${freshVer.code})`);
                                          } catch (e) {
                                            const url = getVersionVideoUrl(ver);
                                            setActiveVideoUrl(url);
                                            setActiveVideoTitle(`${selectedStatusProject.name} (Selected: ${ver.code})`);
                                          }
                                        }}
                                        className="bg-stone-50/60 border border-stone-200/80 rounded-xl p-3 md:py-3.5 md:px-4 flex items-start justify-between shadow-3xs hover:border-indigo-400 hover:bg-indigo-50/10 cursor-pointer transition gap-4"
                                      >
                                        <div className="flex items-start space-x-3.5 md:space-x-5 min-w-0 flex-1">
                                          {/* Version Thumbnail */}
                                          <div className="w-[84px] h-[54px] md:w-[120px] md:h-[76px] bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 relative overflow-hidden group/ver shadow-inner">
                                            {ver.image ? (
                                              <>
                                                <img
                                                  src={ver.image}
                                                  alt={ver.code}
                                                  className="object-cover w-full h-full group-hover/ver:scale-105 transition duration-300"
                                                  referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover/ver:bg-black/35 flex items-center justify-center transition duration-200">
                                                  <PlayCircle className="w-5 h-5 md:w-6 md:h-6 text-white/0 group-hover/ver:text-white/100 drop-shadow-md transition" />
                                                </div>
                                              </>
                                            ) : (
                                              <PlayCircle className="w-5 h-5 text-stone-400 fill-stone-100 group-hover/ver:text-indigo-500 transition" />
                                            )}
                                          </div>

                                          {/* Version Metadata: Left side */}
                                          <div className="min-w-0 flex-1">
                                            {ver.created_at && (
                                              <div className="flex items-center mb-1.5">
                                                <span className="text-[9px] md:text-[10px] text-stone-400 font-mono bg-stone-100 border border-stone-200/50 px-1.5 py-0.5 rounded">
                                                  {(() => {
                                                    try {
                                                      const d = new Date(ver.created_at);
                                                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                                                      const dd = String(d.getDate()).padStart(2, "0");
                                                      const hh = String(d.getHours()).padStart(2, "0");
                                                      const min = String(d.getMinutes()).padStart(2, "0");
                                                      return `${mm}-${dd} ${hh}:${min}`;
                                                    } catch (e) {
                                                      return "";
                                                    }
                                                  })()}
                                                </span>
                                              </div>
                                            )}
                                            <h4 className="text-xs md:text-sm font-bold text-stone-850 break-all whitespace-normal" title={ver.code}>
                                              {ver.code}
                                            </h4>
                                          </div>
                                        </div>

                                        {/* Status: Right side */}
                                        <div className="flex items-center flex-shrink-0 self-start mt-0.5 md:mt-1">
                                          <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider border ${verStatusStyle.bg} ${verStatusStyle.text} ${verStatusStyle.border}`}>
                                            {verStatusStyle.label}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white py-3 px-6 border-t border-stone-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedStatusProject(null)}
                className="px-6 py-2.5 bg-stone-950 hover:bg-stone-850 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition shadow-md"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* D-Day Modal - Full Screen */}
      {showDday && (
        <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-white py-2 px-4 border-b border-stone-150 flex items-center justify-between shadow-3xs">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base md:text-lg font-black text-stone-900 leading-none uppercase tracking-wide">D-DAY</h2>
                </div>
                <button
                  onClick={() => setShowDday(false)}
                  className="p-1.5 md:p-2 rounded-xl border border-stone-150 hover:bg-stone-150/60 cursor-pointer text-stone-500 hover:text-stone-850 transition shadow-3xs flex items-center justify-center bg-white"
                >
                  <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-stone-50/60">
              <div className="max-w-5xl mx-auto w-full px-5 py-3 md:py-4 space-y-4">
                {ddayLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <Loader2 className="w-9 h-9 text-rose-600 animate-spin" />
                    <p className="text-[11px] text-stone-450 font-extrabold uppercase tracking-widest animate-pulse">D-day 마감 일정을 취합 중입니다...</p>
                  </div>
                ) : ddayError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs text-rose-800 font-medium">
                    {ddayError}
                  </div>
                ) : ddayData.length === 0 ? (
                  <div className="text-center py-20 bg-white border border-stone-200/80 rounded-[32px] p-8 max-w-lg mx-auto shadow-xs">
                    <CalendarRange className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <h3 className="text-sm font-black text-stone-800">이번주 마감 예정인 태스크가 없습니다</h3>
                    <p className="text-xs text-stone-400 mt-1">오늘부터 이번주 일요일 사이에 기한인 컴포지트 작업이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 컴포지트 태스크 상태 필터링 바 */}
                    <div className="bg-white border border-stone-200/80 rounded-[24px] p-4 px-5 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black uppercase text-stone-450 tracking-wider">COMP 태스크 상태 필터</span>
                        {ddayStatusFilter.length > 0 && (
                          <button
                            onClick={() => setDdayStatusFilter([])}
                            className="text-[9px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5 cursor-pointer self-start sm:self-auto transition"
                          >
                            필터 초기화
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableDdayStatuses.map((status) => {
                          const style = getStatusStyle(status);
                          const isSelected = ddayStatusFilter.includes(status);
                          return (
                            <button
                              key={status}
                              onClick={() => {
                                if (isSelected) {
                                  setDdayStatusFilter(ddayStatusFilter.filter((s) => s !== status));
                                } else {
                                  setDdayStatusFilter([...ddayStatusFilter, status]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase leading-none min-w-[50px] text-center shadow-3xs border transition cursor-pointer flex items-center space-x-1.5 ${
                                isSelected
                                  ? `${style.bg} ${style.text} ${style.border} ring-2 ring-stone-950 ring-offset-1`
                                  : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
                              }`}
                            >
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                              <span>{style.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {filteredDdayData.length === 0 ? (
                      <div className="text-center py-20 bg-white border border-stone-200/80 rounded-[32px] p-8 max-w-lg mx-auto shadow-xs">
                        <CalendarRange className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                        <h3 className="text-sm font-black text-stone-800">해당 상태에 매칭되는 태스크가 없습니다</h3>
                        <p className="text-xs text-stone-400 mt-1">상태 필터를 클릭하여 다른 옵션을 선택해보세요.</p>
                      </div>
                    ) : (
                      filteredDdayData.map((projectReport) => (
                      <div key={projectReport.id} className="bg-transparent py-4 border-b border-stone-200/60 last:border-b-0 space-y-3">
                        {/* Project Header */}
                        <div className="flex items-center justify-between pb-2">
                          <div>
                            {projectReport.code && (
                              <span className="text-[9px] text-stone-400 font-mono tracking-wider uppercase font-black block leading-none mb-1">{projectReport.code}</span>
                            )}
                            <h3 className="text-base md:text-2xl font-black text-stone-900 leading-tight">{projectReport.name}</h3>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-stone-450 bg-stone-100/75 px-2.5 py-1 rounded-xl font-mono">
                              {projectReport.tasks.length} tasks
                            </span>
                          </div>
                        </div>

                        {/* Tasks List */}
                        <div className="divide-y divide-stone-150/60 w-full">
                          {projectReport.tasks.map((task: any) => {
                            const style = getStatusStyle(task.status);
                            
                            // Calculate D-day
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const tDate = new Date(task.due_date);
                            tDate.setHours(0,0,0,0);
                            const diffTime = tDate.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            let ddayText = "";
                            let ddayBadgeClass = "";
                            if (diffDays === 0) {
                              ddayText = "D-Day";
                              ddayBadgeClass = "bg-rose-500 text-white font-black border-rose-600";
                            } else if (diffDays > 0) {
                              ddayText = `D-${diffDays}`;
                              ddayBadgeClass = "bg-amber-100 text-amber-800 font-bold border-amber-200";
                            } else {
                              ddayText = `D+${Math.abs(diffDays)}`;
                              ddayBadgeClass = "bg-stone-200 text-stone-700 font-bold border-stone-300";
                            }

                            const isExpanded = ddayExpandedShotId === task.entity?.id;

                            return (
                              <div key={task.id} className="flex flex-col border-b border-stone-100 last:border-b-0">
                                {/* Shot Row trigger */}
                                <div 
                                  onClick={() => {
                                    if (!task.entity?.id) return;
                                    const shotId = task.entity.id;
                                    if (ddayExpandedShotId === shotId) {
                                      setDdayExpandedShotId(null);
                                    } else {
                                      setDdayExpandedShotId(shotId);
                                      if (!ddayShotVersions[shotId]) {
                                        setDdayVersionsLoading(prev => ({ ...prev, [shotId]: true }));
                                        fetch(`/api/versions?entity_id=${shotId}`)
                                          .then(res => {
                                            if (!res.ok) throw new Error("버전 로드 실패");
                                            return res.json();
                                          })
                                          .then(data => {
                                            setDdayShotVersions(prev => ({ ...prev, [shotId]: data }));
                                            setDdayVersionsLoading(prev => ({ ...prev, [shotId]: false }));
                                          })
                                          .catch(err => {
                                            console.error(err);
                                            setDdayVersionsLoading(prev => ({ ...prev, [shotId]: false }));
                                          });
                                      }
                                    }
                                  }}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-1 gap-3 hover:bg-stone-50/50 cursor-pointer transition select-none"
                                  title="클릭하여 하위 버전 리스트 보기"
                                >
                                  <div className="flex items-center space-x-3 min-w-0">
                                    {/* D-Day badge */}
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${ddayBadgeClass}`}>
                                      {ddayText}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center space-x-1.5">
                                        <h4 className="text-xs font-black text-stone-900 group-hover:text-amber-800 transition flex items-center pr-1 tracking-tight">
                                          {task.shot_code}
                                        </h4>
                                        <span className="text-[7.5px] bg-amber-50 text-amber-700 font-extrabold uppercase px-1 rounded border border-amber-100">
                                          COMP
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-stone-400 font-bold mt-0.5 break-all whitespace-normal">{task.content || "COMP Task"}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-4 self-end sm:self-center">
                                    {/* Due Date */}
                                    <div className="text-right flex flex-col">
                                      <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">Due Date</span>
                                      <span className="text-xs font-extrabold font-mono text-stone-700">{task.due_date}</span>
                                    </div>

                                    {/* Assignee */}
                                    <div className="text-right flex flex-col min-w-[70px] sm:min-w-[80px]">
                                      <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider font-sans">담당자</span>
                                      <span className="text-xs font-black text-stone-850 break-all whitespace-normal sm:max-w-[120px] sm:truncate">{task.assignee || "미배정"}</span>
                                    </div>

                                    {/* Status */}
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${style.bg} ${style.text} ${style.border}`}>
                                      {style.label}
                                    </span>
                                  </div>
                                </div>

                                {/* Dynamic Versions Accordion Block */}
                                {isExpanded && task.entity?.id && (
                                  <div className="bg-stone-50/70 p-4 border-t border-b border-stone-150/60 space-y-2.5 mx-4 mb-4 rounded-2xl border">
                                    <div className="flex items-center justify-between border-b border-stone-150 pb-1.5">
                                      <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest flex items-center">
                                        <Film className="w-3.5 h-3.5 text-rose-500 mr-1.5 animate-pulse" /> 이 샷의 버전 목록 (Versions)
                                      </span>
                                      {ddayShotVersions[task.entity.id] && (
                                        <span className="text-[8px] bg-rose-50 border border-rose-200 text-rose-700 font-black px-1.5 py-0.5 rounded uppercase leading-none shadow-3xs">
                                          {ddayShotVersions[task.entity.id].length} Versions
                                        </span>
                                      )}
                                    </div>

                                    {ddayVersionsLoading[task.entity.id] ? (
                                      <div className="flex items-center justify-center py-4 space-x-2">
                                        <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                                        <span className="text-[9px] text-stone-400 uppercase tracking-wider font-black animate-pulse">버전 리스트 로드 중...</span>
                                      </div>
                                    ) : !ddayShotVersions[task.entity.id] || ddayShotVersions[task.entity.id].length === 0 ? (
                                      <p className="text-[10px] text-stone-400 font-bold italic text-center py-3">등록된 버전 영상이 없습니다.</p>
                                    ) : (
                                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                        {ddayShotVersions[task.entity.id].map((ver) => (
                                          <div 
                                            key={ver.id} 
                                            onClick={async () => {
                                              try {
                                                // Dynamic real-time S3 presigned URL fetching on click
                                                setActiveVideoTitle(`${task.shot_code} (${ver.code}) 로딩 중...`);
                                                const res = await fetch(`/api/version/${ver.id}`);
                                                if (!res.ok) throw new Error("로드 실패");
                                                const freshVer = await res.json();
                                                const url = getVersionVideoUrl(freshVer);
                                                setActiveVideoUrl(url);
                                                setActiveVideoTitle(`${task.shot_code} (Selected: ${freshVer.code})`);
                                              } catch (e) {
                                                console.error("Falling back to standard url:", e);
                                                const url = getVersionVideoUrl(ver);
                                                setActiveVideoUrl(url);
                                                setActiveVideoTitle(`${task.shot_code} (Selected: ${ver.code})`);
                                              }
                                            }}
                                            className="bg-white border border-stone-150 hover:border-rose-350 hover:bg-rose-50/5 rounded-xl p-2.5 flex items-center justify-between hover:scale-[0.995] active:scale-[0.99] transition cursor-pointer shadow-3xs group/ver"
                                            title="클릭하여 미디어 어셋 재생"
                                          >
                                            <div className="flex items-center space-x-3 min-w-0">
                                              {/* Preview Thumbnail */}
                                              <div className="w-12 h-8 bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 relative overflow-hidden transition group-hover/ver:border-rose-400">
                                                {ver.image ? (
                                                  <>
                                                    <img 
                                                      src={ver.image} 
                                                      alt={ver.code} 
                                                      className="object-cover w-full h-full group-hover/ver:scale-105 transition"
                                                      referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover/ver:bg-black/25 flex items-center justify-center transition">
                                                      <PlayCircle className="w-3.5 h-3.5 text-white/0 group-hover/ver:text-white/90 drop-shadow transition" />
                                                    </div>
                                                  </>
                                                ) : (
                                                  <PlayCircle className="w-3.5 h-3.5 text-stone-400 fill-stone-100 group-hover/ver:text-rose-500 transition" />
                                                )}
                                              </div>

                                              {/* Version Info */}
                                              <div className="min-w-0 flex-1">
                                                <h5 className="text-[10px] font-black text-stone-800 break-all whitespace-normal group-hover/ver:text-rose-950 transition">{ver.code}</h5>
                                                <div className="flex items-center space-x-1.5 mt-0.5">
                                                  <span className="px-1 py-0.1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[7px] font-black uppercase">
                                                    {ver.sg_status_list ? ver.sg_status_list.toUpperCase() : "REV"}
                                                  </span>
                                                  <span className="text-[8px] text-stone-400 font-mono font-bold">v{ver.sg_version_number || 1}</span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-1 text-[8.5px] font-black text-rose-550 group-hover/ver:text-rose-650 tracking-wider uppercase transition">
                                              <span>PLAY</span>
                                              <PlayCircle className="w-3.5 h-3.5" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-5 border-t border-stone-150 flex justify-end shadow-sm">
              <div className="max-w-5xl mx-auto w-full flex justify-end">
                <button
                  onClick={() => setShowDday(false)}
                  className="px-6 py-3 bg-stone-900 hover:bg-stone-850 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition shadow-md"
                >
                  닫기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Dynamic Popover / Overlay Video Player Modal inside ProjectList */}
      {activeVideoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#1A1F2C] border border-[#232B3E] rounded-3xl p-5 shadow-2xl relative w-full max-w-3xl text-white">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-white truncate pr-4">
                🎬 {activeVideoTitle || "프록시 미디어 재생"}
              </h3>
              <button
                onClick={() => {
                  setActiveVideoUrl(null);
                  setActiveVideoTitle(null);
                }}
                className="text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-full p-1.5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="bg-black rounded-2xl overflow-hidden aspect-video border border-stone-900/40 relative shadow-inner">
              <video
                src={activeVideoUrl}
                key={activeVideoUrl}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to normalize ShotGrid statuses to the 18 standard ones requested by the user
function normalizeToStandardStatus(rawStatus: string): string {
  const code = (rawStatus || "").toLowerCase().trim();
  if (["fin", "approved", "apr", "final", "complete", "cmpt", "res", "delivered", "dlvr", "y"].includes(code)) return "fin";
  if (["qc", "pending_review", "rev", "review", "pndng", "vwd", "recd", "cfm", "cfrm"].includes(code)) return "qc";
  if (["di-sen", "di_sen", "dis"].includes(code)) return "di-sen";
  if (code === "dok") return "dok";
  if (code === "cto") return "cto";
  if (["ctp", "pub", "tpub", "t-pub"].includes(code)) return "ctp";
  if (code === "cts") return "cts";
  if (code === "ct") return "ct";
  if (["sc", "sv"].includes(code)) return "sc";
  if (code === "cc") return "cc";
  if (code === "pc") return "pc";
  if (code === "tc") return "tc";
  if (code === "kg") return "kg";
  if (["wip", "ip", "inprogress", "in_progress", "act", "active"].includes(code)) return "wip";
  if (code === "rd") return "rd";
  if (["drt", "dr", "director retake", "edc", "edit change"].includes(code)) return "drt";
  if (["ctr", "client retake", "sr", "supervisor retake", "d_retake"].includes(code)) return "ctr";
  if (code === "rt") return "rt";
  
  return "wtg";
}

// Render dynamic actual status breakdown with real ShotGrid codes 
function renderStatusCounts(
  projectId: number,
  projectName: string,
  projectCode: string,
  category: string,
  statusStats: Record<string, number> = {},
  onStatusClick?: (projectId: number, projectName: string, projectCode: string, category: string, status: string) => void
) {
  // Normalize and aggregate counts
  const aggregated: Record<string, number> = {};
  let totalActive = 0;
  
  Object.entries(statusStats).forEach(([rawKey, count]) => {
    if (count > 0) {
      const stdKey = normalizeToStandardStatus(rawKey);
      aggregated[stdKey] = (aggregated[stdKey] || 0) + count;
      totalActive += count;
    }
  });

  if (totalActive === 0) {
    return (
      <div className="text-center py-4 text-[10px] text-stone-400 font-bold font-mono tracking-wider bg-transparent border border-dashed border-stone-200 rounded-xl uppercase">
        NO ACTIVE TASKS
      </div>
    );
  }

  // Define lists for 4 horizontal sections as requested:
  // Section 1: Left [fin, qc, di-sen, dok], Right []
  const sec1Left = ["fin", "qc", "di-sen", "dok"];
  const sec1Right: string[] = [];
  
  // Section 2: Left [cto], Right [drt]
  const sec2Left = ["cto"];
  const sec2Right = ["drt"];
  
  // Section 3: Left [ctp, cts, sc, ct, cc], Right [ctr]
  const sec3Left = ["ctp", "cts", "sc", "ct", "cc"];
  const sec3Right = ["ctr"];

  // Section 4: Left [pc, tc, kg, wip, rd, wtg], Right [rt]
  const sec4Left = ["pc", "tc", "kg", "wip", "rd", "wtg"];
  const sec4Right = ["rt"];

  const renderSectionRows = (leftList: string[], rightList: string[]) => {
    const rowsCount = Math.max(leftList.length, rightList.length);
    const rows: React.ReactNode[] = [];
    
    for (let i = 0; i < rowsCount; i++) {
      const leftKey = leftList[i];
      const rightKey = rightList[i];
      
      const leftCount = leftKey ? (aggregated[leftKey] || 0) : 0;
      const rightCount = rightKey ? (aggregated[rightKey] || 0) : 0;
      
      // Render the row if at least one column has a count > 0
      if (leftCount > 0 || rightCount > 0) {
        rows.push(
          <div key={i} className="grid grid-cols-2 gap-x-4 py-1.5 items-center">
            {/* Left Column */}
            <div>
              {leftCount > 0 ? (
                <div 
                  onClick={() => onStatusClick?.(projectId, projectName, projectCode, category, leftKey)}
                  className="flex items-center justify-between py-1 px-1.5 hover:bg-stone-150/70 active:bg-stone-200/50 rounded-lg transition min-h-[32px] cursor-pointer"
                  title={`${getStatusStyle(leftKey).label} 버전 리스트 보기`}
                >
                  <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-[11px] font-black tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${getStatusStyle(leftKey).bg} ${getStatusStyle(leftKey).text} ${getStatusStyle(leftKey).border}`}>
                    {getStatusStyle(leftKey).label}
                  </span>
                  <div className="flex items-center space-x-1 font-mono flex-shrink-0">
                    <span className="text-sm md:text-base font-black text-stone-900">{leftCount}</span>
                    <span className="text-[10px] md:text-xs text-stone-400 font-bold font-sans">개</span>
                  </div>
                </div>
              ) : (
                <div className="min-h-[32px]" />
              )}
            </div>
            
            {/* Right Column */}
            <div>
              {rightCount > 0 ? (
                <div 
                  onClick={() => onStatusClick?.(projectId, projectName, projectCode, category, rightKey)}
                  className="flex items-center justify-between py-1 px-1.5 hover:bg-stone-150/70 active:bg-stone-200/50 rounded-lg transition min-h-[32px] cursor-pointer"
                  title={`${getStatusStyle(rightKey).label} 버전 리스트 보기`}
                >
                  <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-[11px] font-black tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${getStatusStyle(rightKey).bg} ${getStatusStyle(rightKey).text} ${getStatusStyle(rightKey).border}`}>
                    {getStatusStyle(rightKey).label}
                  </span>
                  <div className="flex items-center space-x-1 font-mono flex-shrink-0">
                    <span className="text-sm md:text-base font-black text-stone-900">{rightCount}</span>
                    <span className="text-[10px] md:text-xs text-stone-400 font-bold font-sans">개</span>
                  </div>
                </div>
              ) : (
                <div className="min-h-[32px]" />
              )}
            </div>
          </div>
        );
      }
    }
    return rows;
  };

  const sec1Rows = renderSectionRows(sec1Left, sec1Right);
  const sec2Rows = renderSectionRows(sec2Left, sec2Right);
  const sec3Rows = renderSectionRows(sec3Left, sec3Right);
  const sec4Rows = renderSectionRows(sec4Left, sec4Right);

  return (
    <div className="flex flex-col bg-transparent">
      {sec1Rows.length > 0 && (
        <div className="flex flex-col">
          {sec1Rows}
        </div>
      )}
      
      {sec2Rows.length > 0 && (
        <div className="flex flex-col">
          {sec1Rows.length > 0 && <div className="border-t border-stone-300 my-1 w-full" />}
          {sec2Rows}
        </div>
      )}
      
      {sec3Rows.length > 0 && (
        <div className="flex flex-col">
          {(sec1Rows.length > 0 || sec2Rows.length > 0) && <div className="border-t border-stone-300 my-1 w-full" />}
          {sec3Rows}
        </div>
      )}

      {sec4Rows.length > 0 && (
        <div className="flex flex-col">
          {(sec1Rows.length > 0 || sec2Rows.length > 0 || sec3Rows.length > 0) && <div className="border-t border-stone-300 my-1 w-full" />}
          {sec4Rows}
        </div>
      )}
    </div>
  );
}
