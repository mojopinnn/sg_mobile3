import React, { useEffect, useState } from "react";
import { Project, Shot, Version } from "../types";
import { getStatusStyle, cleanAssigneeName } from "../utils";
import { ChevronLeft, Film, PlayCircle, Loader2, Image as ImageIcon, Eye, Clock, Check, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface ProjectDetailProps {
  projectId: number;
  onNavigate: (view: string, params?: any) => void;
}

export default function ProjectDetail({ projectId, onNavigate }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"shots" | "versions">("shots");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    Promise.all([
      fetch(`/api/project/${projectId}/detail`).then((res) => res.json()),
      fetch(`/api/project/${projectId}/shots`).then((res) => res.json()),
      fetch(`/api/project/${projectId}/versions`).then((res) => res.json()),
    ])
      .then(([projData, shotsData, versionsData]) => {
        if (projData && projData.error) {
          setErrorMsg(projData.error);
          setLoading(false);
          return;
        }
        
        setProject(projData);
        setShots(Array.isArray(shotsData) ? shotsData : []);
        setVersions(Array.isArray(versionsData) ? versionsData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading project detail:", err);
        setErrorMsg(err.message || "프로젝트 상세 정보를 불러오는 중 전송 오류가 발생했습니다.");
        setLoading(false);
      });
  }, [projectId]);

  const renderTaskStatusIcon = (status: string) => {
    const code = (status || "").toLowerCase().trim();
    if (["wtg", "waiting", "ready", "ready to start", "readytostart"].includes(code)) {
      return <Clock className="w-3.5 h-3.5 text-stone-400 inline-block ml-1" title="대기 중" />;
    }
    if (["ip", "inprogress", "in_progress", "wip"].includes(code)) {
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin inline-block ml-1" title="진행 중" />;
    }
    if (["rev", "review", "pending_review", "pending", "pnd"].includes(code)) {
      return <Eye className="w-3.5 h-3.5 text-amber-500 inline-block ml-1" title="검토 요청" />;
    }
    if (["fin", "final", "complete", "approved", "apr", "dok", "double check", "doublecheck"].includes(code)) {
      return <Check className="w-3.5 h-3.5 text-emerald-500 inline-block ml-1 font-bold" title="완료" />;
    }
    return <span className="text-[9px] text-stone-400 font-semibold ml-1">({code.toUpperCase()})</span>;
  };

  const formatSlashText = (text: string | undefined | null) => {
    if (!text) return "";
    return text.replaceAll("\r\n", "  /  ").replaceAll("\n", "  /  ");
  };

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border border-rose-200 rounded-3xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-600 rounded-full mb-3">
            <span className="text-xl font-bold">!</span>
          </div>
          <h2 className="text-base font-black text-stone-900">상세 데이터를 불러올 수 없습니다</h2>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            해당 프로젝트 정보를 가져오는 과정에서 서버가 에러를 반환했습니다. 실제 Shotgrid 측 해당 ID 엔티티가 소멸되었거나, 권한이 부족할 수 있습니다.
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl mb-5">
          <p className="text-[11px] font-bold text-rose-800 font-mono break-all text-center">
            {errorMsg}
          </p>
        </div>

        <button
          onClick={() => onNavigate("projects")}
          className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-black text-xs uppercase tracking-wider transition cursor-pointer"
        >
          프로젝트 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase font-mono">Loading specs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Back Header */}
      <div>
        <button
          onClick={() => onNavigate("projects")}
          className="inline-flex items-center text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> 프로젝트 목록으로
        </button>
      </div>

      {/* Project Header section */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">{project.code}</span>
          <h1 className="text-xl font-bold text-stone-950 leading-tight mt-0.5">{project.name}</h1>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] tracking-wider font-extrabold uppercase border bg-emerald-50 text-emerald-700 border-emerald-100">
          {project.sg_status}
        </span>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setActiveTab("shots")}
            className={`flex-1 py-3 text-center border-b-2 font-black text-xs transition uppercase tracking-wider cursor-pointer ${
              activeTab === "shots" ? "border-blue-600 text-blue-600" : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <Film className="w-3.5 h-3.5 mr-1.5 inline-block" /> SHOTS
          </button>
          <button
            onClick={() => setActiveTab("versions")}
            className={`flex-1 py-3 text-center border-b-2 font-black text-xs transition uppercase tracking-wider cursor-pointer ${
              activeTab === "versions" ? "border-blue-600 text-blue-600" : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5 mr-1.5 inline-block" /> VERSIONS
          </button>
        </div>

        {/* Tab 1: Shots */}
        {activeTab === "shots" && (
          <div className="space-y-4">
            {shots.map((shot) => {
              const statusLower = (shot.sg_status_list || "").toLowerCase().trim();
              const isOmitted = ["omit", "omt", "omitted"].includes(statusLower);
              const isHold = ["hold", "hld"].includes(statusLower);

              let blockBg = "bg-white border-stone-200 hover:border-stone-300";
              if (isOmitted) {
                blockBg = "bg-stone-200 border-stone-300 text-stone-500 opacity-80";
              } else if (isHold) {
                blockBg = "bg-stone-100 border-stone-200";
              }

              return (
                <div key={shot.id} className={`${blockBg} border rounded-3xl p-4 flex flex-col space-y-3 shadow-sm transition`}>
                  {/* Upper Grid Layout: Thumbnail, Mid column layout cells, status */}
                  <div className="flex items-start space-x-4">
                    {/* Left Thumbnail Column */}
                    <div className="flex flex-col items-center space-y-2 w-24 flex-shrink-0">
                      <div className="w-24 h-16 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
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
                      </div>
                      <span className="text-[10px] font-black text-stone-800 text-center truncate w-full tracking-wider">
                        {shot.code}
                      </span>
                    </div>

                    {/* Mid Text Segment cells divided vertically */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 min-h-[4rem] py-0.5">
                      {/* Upper: Description */}
                      <div className="text-[11px] text-stone-800 whitespace-normal break-all">
                        {shot.description ? (
                          <>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-wide mr-1.5">
                              Description:
                            </span>
                            {formatSlashText(shot.description)}
                          </>
                        ) : (
                          <span className="text-[9px] font-bold text-stone-300 italic">No description provided</span>
                        )}
                      </div>
                      <div className="border-t border-stone-100 my-1"></div>
                      {/* Lower: Work Order */}
                      <div className="text-[11px] text-stone-800 whitespace-normal break-all">
                        {shot.sg_work_order ? (
                          <>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-wide mr-1.5">
                              Work Order:
                            </span>
                            {formatSlashText(shot.sg_work_order)}
                          </>
                        ) : (
                          <span className="text-[9px] font-bold text-stone-300 italic">No work order associated</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Status symbol */}
                    <div className="flex-shrink-0 flex items-center h-16 pl-2">
                      <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-white text-stone-700 border border-stone-200 shadow-sm font-mono">
                        {shot.sg_status_list ? shot.sg_status_list.toUpperCase() : "WTG"}
                      </span>
                    </div>
                  </div>

                  {/* Bottom pipeline tracks */}
                  <div className="pt-2.5 border-t border-stone-100 bg-stone-50/50 p-2.5 rounded-2xl border border-stone-100/60 flex flex-col space-y-1.5">
                    {shot.parsed_tasks && shot.parsed_tasks.length > 0 ? (
                      <>
                        {/* Standard tracks (Not Roto or Remove) */}
                        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-stone-500 w-full font-sans">
                          {shot.parsed_tasks
                            .filter((task) => !task.step.toLowerCase().includes("roto") && !task.step.toLowerCase().includes("remove"))
                            .map((task) => (
                              <div key={task.id} className="inline-flex items-center space-x-1">
                                <span className="font-extrabold text-[9px] text-stone-400 uppercase tracking-wider">
                                  {task.step.toLowerCase()}
                                </span>
                                <span className="text-stone-700 font-bold text-[11px] flex items-center">
                                  {cleanAssigneeName(task.assignee_name)}
                                  {renderTaskStatusIcon(task.status)}
                                </span>
                              </div>
                            ))}
                        </div>

                        {/* Special tracks (Roto, Remove) */}
                        {shot.parsed_tasks.some((task) => task.step.toLowerCase().includes("roto") || task.step.toLowerCase().includes("remove")) && (
                          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-stone-500 w-full border-t border-stone-200/40 pt-1.5 mt-0.5 font-sans">
                            {shot.parsed_tasks
                              .filter((task) => task.step.toLowerCase().includes("roto") || task.step.toLowerCase().includes("remove"))
                              .map((task) => (
                                <div key={task.id} className="inline-flex items-center space-x-1">
                                  <span className="font-extrabold text-[9px] text-stone-400 uppercase tracking-wider">
                                    {task.step.toLowerCase()}
                                  </span>
                                  <span className="text-stone-700 font-bold text-[11px] flex items-center">
                                    {cleanAssigneeName(task.assignee_name)}
                                    {renderTaskStatusIcon(task.status)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-right text-stone-400 text-[10px] font-bold">작업 노드 구성 없음</div>
                    )}
                  </div>
                </div>
              );
            })}

            {shots.length === 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 shadow-sm">
                <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">프로젝트 하위에 등록된 샷이 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Versions */}
        {activeTab === "versions" && (
          <div className="space-y-3">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="bg-white border border-stone-200 rounded-3xl p-4 flex items-center space-x-4 shadow-sm hover:border-stone-300 transition"
              >
                <div className="w-20 h-12 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 relative overflow-hidden">
                  <PlayCircle className="w-5 h-5 text-stone-400 fill-stone-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-stone-400 uppercase font-black tracking-widest block mb-0.5">
                    {ver.entity?.name || "No Entity"}
                  </span>
                  <h3 className="text-xs font-black text-stone-850 truncate">{ver.code}</h3>
                  <div className="flex justify-between items-center mt-1">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-100">
                      {ver.sg_status_list ? ver.sg_status_list.toUpperCase() : "REV"}
                    </span>
                    <span className="text-[9px] text-stone-450 font-mono">v{ver.sg_version_number || 1}</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate("version_detail", { versionId: ver.id })}
                  className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl p-2.5 transition text-blue-600 hover:text-blue-800"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ))}

            {versions.length === 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 shadow-sm">
                <PlayCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">프로젝트 하위에 등록된 영상 버젼이 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
