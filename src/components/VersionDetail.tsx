import React, { useEffect, useState } from "react";
import { Version } from "../types";
import { ChevronLeft, Loader2, PlayCircle, Eye, CheckCircle2, MessageSquare, MonitorPlay } from "lucide-react";
import { motion } from "motion/react";

interface VersionDetailProps {
  versionId: number;
  onNavigate: (view: string, params?: any) => void;
}

export default function VersionDetail({ versionId, onNavigate }: VersionDetailProps) {
  const [version, setVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    fetch(`/api/version/${versionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.error) {
          setErrorMsg(data.error);
        } else {
          setVersion(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading version detail:", err);
        setErrorMsg(err.message || "버전 미디어를 로드하는 과정에서 통신 실패가 발생했습니다.");
        setLoading(false);
      });
  }, [versionId]);

  const handleReview = (status: "apr" | "rev") => {
    setSubmitting(true);
    fetch(`/api/version/${versionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note_content: noteContent })
    })
      .then((res) => res.json())
      .then((data) => {
        setSubmitting(false);
        if (data.success) {
          // Navigate back to project detail
          onNavigate("project_detail", { projectId: version?.project?.id });
        }
      })
      .catch((err) => {
        console.error("Error submitting review:", err);
        setSubmitting(false);
      });
  };

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border border-rose-200 rounded-3xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-600 rounded-full mb-3">
            <span className="text-xl font-bold">!</span>
          </div>
          <h2 className="text-base font-black text-stone-900">버전 데이터를 불러올 수 없습니다</h2>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            해당 버전 미디어 정보를 가져오는 과정에서 서버 에러가 보고되었습니다. 실제 ShotGrid 사이트에 이 버전(ID: {versionId})이 존재하지 않거나, 보안 권한 정책에 의해 접근이 불가할 수 있습니다.
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
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  if (loading || !version) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase font-mono">Loading screening media...</p>
      </div>
    );
  }

  // Determine video URL
  let videoUrl = "";
  if (version.id === 101) {
    videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-nebula-of-outer-space-background-30048-large.mp4";
  } else if (version.id === 102) {
    videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-41723-large.mp4";
  }

  return (
    <div className="space-y-6">
      {/* Navigation back and header */}
      <div>
        <button
          onClick={() => onNavigate("project_detail", { projectId: version.project?.id })}
          className="inline-flex items-center text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> 검토 목록으로 돌아가기
        </button>
      </div>

      {/* Main video asset container card */}
      <div className="bg-[#1A1F2C] border border-[#232B3E] rounded-3xl p-5 shadow-xl text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-xs text-blue-400 font-bold tracking-wider font-mono uppercase truncate block max-w-[200px]">
              {version.project?.name}
            </span>
            <h1 className="text-lg font-black text-white mt-1 leading-snug">{version.code}</h1>
            <p className="text-[10px] text-stone-400 mt-1 uppercase font-bold tracking-widest font-mono">
              연동 대상: {version.entity?.name || "미지정"} • VER v{version.sg_version_number || 1}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
            version.sg_status_list === "rev" 
              ? "bg-amber-900/40 text-amber-300 border-amber-600/30" 
              : version.sg_status_list === "apr" 
              ? "bg-emerald-900/45 text-emerald-300 border-emerald-500/30" 
              : "bg-stone-800 text-stone-400 border-stone-700"
          }`}>
            {version.sg_status_list ? version.sg_status_list.toUpperCase() : "REV"}
          </span>
        </div>

        {/* Dynamic HTML5 Playback Box */}
        <div className="bg-black rounded-2xl overflow-hidden border border-[#0d1017] aspect-video mb-5 shadow-2xl relative flex flex-col justify-center">
          {videoUrl ? (
            <video 
              key={videoUrl}
              className="w-full h-full object-contain" 
              controls 
              playsInline
              src={videoUrl}
            >
              동영상을 지원하지 않는 웹 브라우저입니다.
            </video>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-black/90">
              <MonitorPlay className="w-10 h-10 text-stone-700 mb-2" />
              <p className="text-xs font-extrabold text-stone-400">미디어 미리보기 (데모 데이터)</p>
              <p className="text-[9px] text-stone-500 mt-1 uppercase tracking-wider font-mono">
                Actual shotgrid version file is linked on live server.
              </p>
            </div>
          )}
        </div>

        {/* Supervisor Approval Control Panel */}
        <div className="bg-[#11141D]/90 border border-[#232B3E] rounded-2xl p-4">
          <h2 className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3.5 flex items-center">
            <MessageSquare className="w-4.5 h-4.5 text-blue-400 mr-2" /> 디렉터/수퍼바이저 신속 승인 결재 피드
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5 font-mono">
                Review Opinion & Instructions
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
                placeholder="동영상 리뷰 후 의견을 남겨주시면, 이 내용은 샷그리드(Shotgrid)에 새 피드백 노트(Note)로 자동 등록되어 아티스트에게 즉시 전달됩니다."
                className="w-full bg-[#161A25] border border-stone-850 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-stone-600 block whitespace-normal"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-1">
              <button
                disabled={submitting}
                onClick={() => handleReview("rev")}
                className="flex items-center justify-center py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" /> 수정 요청 (Revision)
              </button>
              <button
                disabled={submitting}
                onClick={() => handleReview("apr")}
                className="flex items-center justify-center py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition duration-150 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> 승인 완료 (Approve)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
