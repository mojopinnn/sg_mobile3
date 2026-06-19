import React, { useEffect, useState } from "react";
import { Project } from "../types";
import { FolderKanban, Loader2, BarChart2, ClipboardList, CalendarRange, Film, X } from "lucide-react";
import { motion } from "motion/react";
import { getStatusStyle } from "../utils";

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
            <div className="p-4 border-b border-stone-150 bg-stone-50/50 w-full">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] text-stone-450 font-mono tracking-wider">{proj.code}</span>
                <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-100">
                  {proj.sg_status}
                </span>
              </div>
              <h2 className="text-sm font-black text-stone-900 line-clamp-1">{proj.name}</h2>
            </div>
            
            {/* Card Body */}
            <div className="p-4 bg-white flex-1 flex flex-col justify-between w-full space-y-4">
              {/* Total Progress Bars */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest flex items-center">
                    <BarChart2 className="w-3 h-3 text-blue-500 mr-1" /> TOTAL PROGRESS
                  </span>
                  <div className="flex items-center space-x-1.5 font-mono">
                    <span className="text-[8px] font-semibold text-stone-400">
                      ({proj.progress_3}% / {proj.progress_2}%)
                    </span>
                    <span className={`text-xs font-black ${proj.sg_sub_status_gray ? "text-stone-500" : "text-blue-600"}`}>
                      {proj.progress_1}%
                    </span>
                  </div>
                </div>

                {/* Layered Bar presentation */}
                <div className="relative w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-150 p-[1px]">
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

              {/* Matte and Comp stats */}
              <div className="grid grid-cols-2 gap-4 text-[10px] text-stone-600 pt-3 border-t border-stone-100">
                <div className="flex justify-between items-center bg-stone-50/50 p-2 rounded-xl border border-stone-100">
                  <span className="font-extrabold text-stone-400 uppercase tracking-wider">MATTE</span>
                  <span className="font-black text-stone-900 font-mono">
                    {proj.matte_progress !== null ? `${proj.matte_progress}%` : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-stone-50/50 p-2 rounded-xl border border-stone-100">
                  <span className="font-extrabold text-stone-400 uppercase tracking-wider">COMP</span>
                  <span className="font-black text-stone-900 font-mono">
                    {proj.comp_progress !== null ? `${proj.comp_progress}%` : "-"}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full bg-white border border-stone-200 rounded-3xl p-10 text-center text-stone-500 shadow-sm">
            <FolderKanban className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-semibold">활성화된 프로젝트 데이터가 없거나 모두 완료되었습니다.</p>
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
            <div className="bg-white p-5 border-b border-stone-150 flex items-center justify-between shadow-3xs">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/50 shadow-3xs">
                    <ClipboardList className="w-5 h-5 flex-shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-stone-900 leading-tight">프로젝트별 공정 샷 & 태스크 보고서</h2>
                    <p className="text-[10px] md:text-xs text-stone-400 font-bold tracking-tight">Active project shot counts & step task breakdown</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-2 md:p-2.5 rounded-2xl border border-stone-150 hover:bg-stone-150/60 cursor-pointer text-stone-500 hover:text-stone-850 transition shadow-3xs flex items-center justify-center bg-white"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-stone-50/60">
              <div className="max-w-5xl mx-auto w-full px-5 py-6 md:py-10 space-y-6">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
                    <p className="text-[11px] text-stone-450 font-extrabold uppercase tracking-widest animate-pulse">보고서 데이터를 집계 중입니다...</p>
                  </div>
                ) : reportError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs text-rose-800 font-medium">
                    {reportError}
                  </div>
                ) : reportData.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 text-xs font-semibold">
                    진행 중인 활성 프로젝트가 존재하지 않습니다.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {reportData.map((projectReport) => (
                      <div key={projectReport.id} className="bg-white border border-stone-200/80 rounded-[24px] p-6 shadow-xs space-y-5">
                        {/* Project Meta Head */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-stone-400 font-mono tracking-wider uppercase font-black">{projectReport.code}</span>
                              <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-100/60">
                                {projectReport.sg_status}
                              </span>
                            </div>
                            <h3 className="text-sm md:text-base font-black text-stone-900 mt-1">{projectReport.name}</h3>
                          </div>
                          {/* Total Shots Badging */}
                          <div className="flex items-center self-start sm:self-center bg-blue-50 text-blue-700 font-extrabold text-[11px] tracking-tight px-3 py-1.5 rounded-xl border border-blue-100/50">
                            <Film className="w-3.5 h-3.5 mr-1.5 text-blue-650" />
                            <span>총 샷 수: <span className="font-mono text-xs font-black">{projectReport.total_shots}</span></span>
                          </div>
                        </div>

                        {/* Comp / Matte details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* COMP Tasks List */}
                          <div className="bg-stone-50/50 border border-stone-200/50 rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-150">
                              <span className="text-xs font-black text-stone-850 tracking-wide">COMP (합성)</span>
                              <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest font-mono">Actual Status Breakdown</span>
                            </div>
                            {renderStatusCounts(projectReport.comp_tasks_by_status)}
                          </div>

                          {/* MATTE Tasks List */}
                          <div className="bg-stone-50/50 border border-stone-200/50 rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-150">
                              <span className="text-xs font-black text-stone-850 tracking-wide">MATTE (매트)</span>
                              <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest font-mono">Actual Status Breakdown</span>
                            </div>
                            {renderStatusCounts(projectReport.matte_tasks_by_status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-5 border-t border-stone-150 flex justify-end shadow-sm">
              <div className="max-w-5xl mx-auto w-full flex justify-end">
                <button
                  onClick={() => setShowReport(false)}
                  className="px-6 py-3 bg-stone-900 hover:bg-stone-850 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition shadow-md"
                >
                  닫기
                </button>
              </div>
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
            <div className="bg-white p-5 border-b border-stone-150 flex items-center justify-between shadow-3xs">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50 shadow-3xs">
                    <CalendarRange className="w-5 h-5 flex-shrink-0 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-stone-900 leading-tight">이번주 COMP 태스크 마감 현황 (D-Day)</h2>
                    <p className="text-[10px] md:text-xs text-stone-400 font-bold tracking-tight">Today and this week's composite task deadlines by project</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDday(false)}
                  className="p-2 md:p-2.5 rounded-2xl border border-stone-150 hover:bg-stone-150/60 cursor-pointer text-stone-500 hover:text-stone-850 transition shadow-3xs flex items-center justify-center bg-white"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-stone-50/60">
              <div className="max-w-5xl mx-auto w-full px-5 py-6 md:py-10 space-y-6">
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
                  <div className="space-y-6">
                    {ddayData.map((projectReport) => (
                      <div key={projectReport.id} className="bg-white border border-stone-200/80 rounded-[24px] p-6 shadow-xs space-y-4">
                        {/* Project Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-stone-400 font-mono tracking-wider uppercase font-black">{projectReport.code}</span>
                              <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-100/60">
                                {projectReport.sg_status}
                              </span>
                            </div>
                            <h3 className="text-sm md:text-base font-black text-stone-900 mt-1">{projectReport.name}</h3>
                          </div>
                          <span className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full font-mono">
                            {projectReport.tasks.length} tasks
                          </span>
                        </div>

                        {/* Tasks List */}
                        <div className="overflow-hidden border border-stone-150 rounded-2xl bg-white shadow-3xs divide-y divide-stone-100">
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
                              ddayText = "D-Day (오늘)";
                              ddayBadgeClass = "bg-rose-500 text-white font-black border-rose-600";
                            } else if (diffDays > 0) {
                              ddayText = `D-${diffDays}`;
                              ddayBadgeClass = "bg-amber-100 text-amber-800 font-bold border-amber-200";
                            } else {
                              ddayText = `D+${Math.abs(diffDays)} (지연)`;
                              ddayBadgeClass = "bg-stone-200 text-stone-700 font-bold border-stone-300";
                            }

                            return (
                              <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-stone-50/45 transition">
                                <div className="flex items-center space-x-3 min-w-0">
                                  {/* D-Day badge */}
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${ddayBadgeClass}`}>
                                    {ddayText}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-extrabold text-stone-900 truncate tracking-tight">{task.shot_code}</h4>
                                    <p className="text-[10px] text-stone-400 font-bold mt-0.5 truncate">{task.content || "COMP Task"}</p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-4 self-end sm:self-center">
                                  {/* Due Date */}
                                  <div className="text-right flex flex-col">
                                    <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">Due Date</span>
                                    <span className="text-xs font-extrabold font-mono text-stone-700">{task.due_date}</span>
                                  </div>

                                  {/* Assignee */}
                                  <div className="text-right flex flex-col min-w-[80px]">
                                    <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider font-sans">담당자</span>
                                    <span className="text-xs font-black text-stone-850 truncate max-w-[120px]">{task.assignee || "미배정"}</span>
                                  </div>

                                  {/* Status */}
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${style.bg} ${style.text} ${style.border}`}>
                                    {style.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
    </div>
  );
}

// Render dynamic actual status breakdown with real ShotGrid codes 
function renderStatusCounts(statusStats: Record<string, number> = {}) {
  const activeKeys = Object.entries(statusStats)
    .filter(([_, count]) => count > 0)
    .map(([key, count]) => {
      const style = getStatusStyle(key);
      return { key, count, style };
    });

  if (activeKeys.length === 0) {
    return (
      <div className="text-center py-5 text-[10px] text-stone-450 font-bold font-mono tracking-wider bg-white border border-stone-150 rounded-xl uppercase">
        NO ACTIVE TASKS IN THIS CATEGORY
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-stone-100 bg-white border border-stone-200/60 rounded-2xl overflow-hidden shadow-3xs">
      {activeKeys.map(({ key, count, style }) => (
        <div 
          key={key} 
          className="flex items-center justify-between px-4 py-3 hover:bg-stone-50/45 transition"
        >
          {/* Left: Status Badge & Code */}
          <div className="flex items-center space-x-3 truncate">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase leading-none min-w-[56px] text-center shadow-3xs border ${style.bg} ${style.text} ${style.border}`}>
              {style.label}
            </span>
            <span className="text-[10px] text-stone-400 font-bold uppercase font-mono truncate">({key})</span>
          </div>

          {/* Right: Task Count */}
          <div className="flex items-center space-x-1 font-mono flex-shrink-0">
            <span className="text-xs md:text-sm font-black text-stone-905">{count}</span>
            <span className="text-[9px] text-stone-400 font-bold font-sans">개</span>
          </div>
        </div>
      ))}
    </div>
  );
}
