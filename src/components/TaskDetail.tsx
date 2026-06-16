import React, { useEffect, useState } from "react";
import { Task } from "../types";
import { getStatusStyle } from "../utils";
import { ChevronLeft, Loader2, Calendar, User, MessageSquare, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

interface TaskDetailProps {
  taskId: number;
  onNavigate: (view: string, params?: any) => void;
}

export default function TaskDetail({ taskId, onNavigate }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("모바일 피드백 노트");
  const [content, setContent] = useState("");
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadTask = () => {
    setLoading(true);
    setErrorMsg(null);
    fetch(`/api/task/${taskId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.error) {
          setErrorMsg(data.error);
        } else {
          setTask(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading task detail:", err);
        setErrorMsg(err.message || "태스크를 로딩하는 도중 통신 오류가 발생했습니다.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const handleStatusUpdate = (status: string) => {
    setUpdating(true);
    fetch(`/api/task/${taskId}/update_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTask(data.task);
        }
        setUpdating(false);
      })
      .catch((err) => {
        console.error("Error updating status:", err);
        setUpdating(false);
      });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setUpdating(true);
    fetch(`/api/task/${taskId}/add_note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, content })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTask(data.task);
          setContent("");
        }
        setUpdating(false);
      })
      .catch((err) => {
        console.error("Error saving note:", err);
        setUpdating(false);
      });
  };

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border border-rose-200 rounded-3xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-600 rounded-full mb-3">
            <span className="text-xl font-bold">!</span>
          </div>
          <h2 className="text-base font-black text-stone-900">태스크 데이터를 불러올 수 없습니다</h2>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            해당 태스크 정보를 가져오는 과정에서 서버 에러가 보고되었습니다. 실제 ShotGrid 사이트에 이 태스크(ID: {taskId})가 존재하지 않거나, 권한 그룹에 포함되지 않았을 가능성이 있습니다.
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl mb-5">
          <p className="text-[11px] font-bold text-rose-800 font-mono break-all text-center">
            {errorMsg}
          </p>
        </div>

        <button
          onClick={() => onNavigate("tasks")}
          className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-black text-xs uppercase tracking-wider transition cursor-pointer"
        >
          태스크 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (loading || !task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase font-mono">Loading core tasks...</p>
      </div>
    );
  }

  const style = getStatusStyle(task.sg_status_list);

  return (
    <div className="space-y-6">
      {/* Back Header */}
      <div>
        <button
          onClick={() => onNavigate("tasks")}
          className="inline-flex items-center text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> 태스크 피드로 돌아가기
        </button>
      </div>

      {/* Task Card Container */}
      <div className="bg-[#1A1F2C] border border-[#232B3E] rounded-3xl p-5 shadow-xl text-white">
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-stone-800/80">
          <div>
            <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">{task.project.name}</span>
            <h1 className="text-lg font-black text-white mt-1 leading-snug">{task.content}</h1>
            <p className="text-[10px] text-stone-400 mt-1.5 uppercase font-bold tracking-wider">
              연동 대상: {task.entity?.name || "None"} ({task.entity?.type || "None"})
            </p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${style.bg} ${style.text} ${style.border} flex-shrink-0 ml-3`}>
            {style.label}
          </span>
        </div>

        {/* Task Metadata Specs Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-5">
          <div className="bg-[#11141D]/60 p-2.5 rounded-2xl border border-stone-800/50">
            <span className="block text-[9px] font-black text-stone-500 uppercase tracking-wider mb-0.5 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-slate-500" /> 시작일
            </span>
            <span className="text-stone-200 font-extrabold">{task.start_date || "지정되지 않음"}</span>
          </div>
          <div className="bg-[#11141D]/60 p-2.5 rounded-2xl border border-stone-800/50">
            <span className="block text-[9px] font-black text-stone-500 uppercase tracking-wider mb-0.5 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-slate-500" /> 마감일
            </span>
            <span className="text-stone-200 font-extrabold">{task.due_date || "지정되지 않음"}</span>
          </div>
          <div className="bg-[#11141D]/60 p-2.5 rounded-2xl border border-stone-800/50">
            <span className="block text-[9px] font-black text-stone-500 uppercase tracking-wider mb-0.5 flex items-center">
              <User className="w-3 h-3 mr-1 text-slate-400" /> 담당 임직원
            </span>
            <span className="text-stone-100 font-black">
              {task.task_assignees && task.task_assignees.length > 0
                ? task.task_assignees.map((assignee) => assignee.name).join(", ")
                : "미지정"}
            </span>
          </div>
          <div className="bg-[#11141D]/60 p-2.5 rounded-2xl border border-[#232B3E]/50">
            <span className="block text-[9px] font-black text-stone-500 uppercase tracking-wider mb-0.5 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1 text-emerald-500" /> 검토 서명인
            </span>
            <span className="text-stone-300 font-extrabold uppercase text-[10px] tracking-wide">프로덕션 수퍼바이저</span>
          </div>
        </div>

        {/* Status Actions */}
        <div className="bg-[#11141D]/80 border border-[#232B3E] rounded-2xl p-4">
          <h2 className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3 flex items-center">
            <Clock className="w-3.5 h-3.5 text-blue-400 mr-2" /> 태스크 상태 원터치 신속 업데이트
          </h2>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "wtg", label: "대기 중 (WTG)", activeClass: "bg-stone-800 text-stone-200 border-stone-500" },
              { id: "ip", label: "진행 중 (IP)", activeClass: "bg-blue-900/30 text-blue-300 border-blue-600" },
              { id: "rev", label: "검토 요청 (REV)", activeClass: "bg-amber-900/30 text-amber-300 border-amber-500/60" },
              { id: "fin", label: "완료 (FIN)", activeClass: "bg-emerald-900/30 text-emerald-300 border-emerald-500" },
            ].map((btn) => {
              const isActive = task.sg_status_list === btn.id;
              return (
                <button
                  key={btn.id}
                  disabled={updating}
                  onClick={() => handleStatusUpdate(btn.id)}
                  className={`py-2.5 rounded-xl border text-[10px] font-black tracking-wider transition uppercase cursor-pointer ${
                    isActive
                      ? btn.activeClass
                      : "bg-[#161A25] text-stone-500 border-stone-800/40 hover:text-stone-300 hover:border-stone-700"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Notes Feed Timeline Panel */}
      <div className="bg-[#1A1F2C] border border-[#232B3E] rounded-3xl p-5 shadow-xl text-white mb-16">
        <h2 className="text-xs font-black text-white mb-4 flex items-center uppercase tracking-wider">
          <MessageSquare className="w-4 h-4 text-indigo-400 mr-2" /> 피드백 및 의사소통 노트
        </h2>

        {/* Note Post Form */}
        <form onSubmit={handleAddNote} className="bg-[#11141D]/50 border border-stone-800 p-4 rounded-2xl mb-5 space-y-3">
          <div>
            <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">노트 타이틀</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#161A25] border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5 font-mono">Feedback Comment</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="아티스트에게 전달할 지시사항이나 피드백 코멘트를 남겨주세요."
              className="w-full bg-[#161A25] border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-stone-600 block whitespace-normal"
              required
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={updating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
          >
            {updating ? "저장 중..." : "피드백 노트 업로드"}
          </button>
        </form>

        {/* Existing Notes Feed */}
        <div className="space-y-3">
          {task.notes && task.notes.length > 0 ? (
            task.notes.map((note) => (
              <div key={note.id} className="bg-[#11141D]/40 border border-stone-800/80 rounded-2xl p-3.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-black text-stone-300">{note.user?.name || "임직원"}</span>
                  <span className="text-[9px] text-stone-500 font-mono">가장 최근</span>
                </div>
                <h4 className="text-[11px] font-black text-indigo-400 mb-1">{note.subject}</h4>
                <p className="text-xs text-stone-450 leading-relaxed whitespace-normal break-all">{note.content}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-stone-500 flex flex-col items-center justify-center">
              <MessageSquare className="w-8 h-8 text-stone-700 mb-1.5" />
              <p className="text-xs font-semibold">등록된 의사소통 피드백 코멘트가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
