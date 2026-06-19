import React, { useEffect, useState } from "react";
import { Task, Project } from "../types";
import { getStatusStyle, cleanAssigneeName } from "../utils";
import { Sliders, ClipboardList, Loader2, RefreshCw } from "lucide-react";

interface TaskListProps {
  initialUserId?: number;
  onNavigate: (view: string, params?: any) => void;
}

export default function TaskList({ initialUserId, onNavigate }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId ? String(initialUserId) : "");

  const [filterOpen, setFilterOpen] = useState(true);

  const fetchTasks = () => {
    setLoading(true);
    setErrorMsg(null);
    const queryParams = new URLSearchParams();
    if (selectedProjectId) queryParams.append("project_id", selectedProjectId);
    if (selectedStatus) queryParams.append("status", selectedStatus);
    if (selectedUserId) queryParams.append("user_id", selectedUserId);

    fetch(`/api/tasks?${queryParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.error) {
          setErrorMsg(data.error);
          setTasks([]);
        } else if (!Array.isArray(data)) {
          setTasks([]);
        } else {
          setTasks(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching tasks:", err);
        setErrorMsg("태스크를 가져오는 중 전송 오류가 발생했습니다.");
        setTasks([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId, selectedStatus, selectedUserId]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data)) {
          setProjects(data);
        } else {
          setProjects([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching projects for filter:", err);
        setProjects([]);
      });
  }, []);

  const handleResetFilters = () => {
    setSelectedProjectId("");
    setSelectedStatus("");
    setSelectedUserId("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col">
        <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Task Board</p>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-0.5">종합 태스크 피드</h1>
      </div>

      {/* Multi-Filters panel */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-sm">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="w-full flex justify-between items-center text-xs font-black text-stone-900 tracking-wider uppercase cursor-pointer"
        >
          <span className="flex items-center">
            <Sliders className="w-4 h-4 text-blue-600 mr-2" /> 검색 및 필터 조건
          </span>
          <span className="text-[10px] text-stone-400">{filterOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>

        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Project dropdown */}
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5 font-mono">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-850 font-bold focus:outline-none"
              >
                <option value="">[전체 프로젝트]</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Status dropdown */}
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5 font-mono">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-850 font-bold focus:outline-none"
              >
                <option value="">[전체 상태]</option>
                <option value="wtg">WTG</option>
                <option value="rd">RD</option>
                <option value="wip">WIP</option>
                <option value="pus">PUS</option>
                <option value="tc">TC</option>
                <option value="pc">PC</option>
                <option value="cc">CC</option>
                <option value="sc">sc (SV)</option>
                <option value="rv">RV</option>
                <option value="pub">Pub</option>
                <option value="tpub">t-Pub</option>
                <option value="rt">RT</option>
                <option value="kg">KG</option>
                <option value="tfin">TFIN</option>
                <option value="fin">FIN</option>
                <option value="ct">CT</option>
                <option value="cts">CTS</option>
              </select>
            </div>

            {/* Artists filter */}
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5 font-mono">Assignee</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-850 font-bold focus:outline-none"
              >
                <option value="">[전체 임직원]</option>
                <option value="4">최동현 (3D Layout)</option>
                <option value="1">김수연 (Animator)</option>
                <option value="2">이우진 (Lighter)</option>
                <option value="3">박지수 (Compositor)</option>
              </select>
            </div>

            {/* Footer controls */}
            <div className="sm:col-span-3 flex justify-end gap-2 pt-3 border-t border-stone-100 mt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl text-xs font-black bg-stone-105 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors uppercase tracking-wider cursor-pointer"
              >
                초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Cards Stack */}
      <div className="space-y-3 mb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-[10px] font-black text-stone-400 tracking-wider">업데이트 중...</span>
          </div>
        ) : tasks.length > 0 ? (
          tasks.map((task) => {
            const style = getStatusStyle(task.sg_status_list);
            return (
              <div
                key={task.id}
                className="bg-[#1A1F2C] border border-[#232B3E] rounded-3xl p-4 shadow-md flex flex-col justify-between transition text-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-widest block mb-1">
                      {task.project?.name}
                    </span>
                    <h2 className="text-sm font-black text-white truncate leading-tight mr-2">{task.content}</h2>
                  </div>
                  <span className={`px-2 py-0.5 rounded-xl text-[8px] font-black uppercase tracking-wider border ${style.bg} ${style.text} ${style.border} flex-shrink-0 ml-2`}>
                    {style.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 mt-3 pt-2.5 border-t border-stone-800/40">
                  <p className="truncate max-w-[150px] font-bold">
                    <span className="text-stone-500 text-[10px] font-medium mr-1 uppercase">대상:</span>
                    <span className="text-stone-300 font-mono tracking-wide">{task.entity?.name || "None"}</span>
                  </p>
                  <p className="font-extrabold text-[11px]">
                    <span className="text-stone-500 text-[10px] font-medium mr-1 uppercase">담당:</span>
                    <span className="text-stone-200">
                      {task.task_assignees && task.task_assignees.length > 0
                        ? cleanAssigneeName(task.task_assignees[0].name)
                        : "미지정"}
                    </span>
                  </p>
                </div>

                <div className="flex justify-end mt-4 pt-3 border-t border-stone-800/40">
                  <button
                    onClick={() => onNavigate("task_detail", { taskId: task.id })}
                    className="w-full text-center py-2.5 rounded-2xl bg-[#11141D] hover:bg-[#151924]/80 border border-stone-800 hover:border-stone-700 text-stone-300 text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    업무 업데이트 & 피드백
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-stone-200 rounded-3xl p-10 text-center text-stone-500">
            <ClipboardList className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-semibold">해당 필터 조건에 부합하는 태스크가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
