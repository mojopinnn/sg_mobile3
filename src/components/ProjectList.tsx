import React, { useEffect, useState } from "react";
import { Project } from "../types";
import { FolderKanban, Loader2, BarChart2 } from "lucide-react";
import { motion } from "motion/react";

interface ProjectListProps {
  onNavigate: (view: string, params?: any) => void;
}

export default function ProjectList({ onNavigate }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      <div>
        <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Active Productions</p>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-0.5">PROJECTS</h1>
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
    </div>
  );
}
