import React, { useEffect, useState } from "react";
import { Project, Shot, Version } from "../types";
import { getStatusStyle, cleanAssigneeName } from "../utils";
import { ChevronLeft, Film, PlayCircle, Loader2, Image as ImageIcon, Eye, Clock, Check, AlertCircle, X, Brain, FileText, Search, Send, Sparkles, ExternalLink, Share2, RefreshCw, Database, ChevronRight, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { VersionChatModal } from "./VersionChatModal";

interface ProjectDetailProps {
  projectId: number;
  onNavigate: (view: string, params?: any) => void;
}

export default function ProjectDetail({ projectId, onNavigate }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [shotsLoading, setShotsLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"shots" | "versions" | "intelligence">("shots");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Drive & Workspace States
  const [driveFiles, setDriveFiles] = useState<any[]>([
    {
      id: "demo1",
      name: "회의록_2026-06-15_에피소드02_조명_및_합성_가이드.txt",
      content: "에피소드 02 야간 전투 씬(EP02) 가이드라인:\n1. 야간 씬이므로 섀도우 영역의 디테일이 완전히 묻히지 않도록 리프트(Lift) 조정에 신경 쓸 것.\n2. 로봇 레이저 타격 시 스파크(Spark) 파티클 강도가 약하다는 피드백. 강도를 1.5배 높이고 카메라 쉐이크(Camera Shake)를 3프레임 정도 추가할 것.\n3. 폭발 불꽃의 하이라이트 부분이 클리핑(White clipping)되지 않게 톤맵 조정 요망.",
      mimeType: "text/plain"
    },
    {
      id: "demo2",
      name: "감독님_특별_지시사항_디렉션_Ep02.txt",
      content: "Ep02 샷 전체 지시사항:\n- 매치무브가 튀는 샷들이 가끔 보임. 액션캠 핸드헬드 롤링 셔터 보정에 신경 쓰고, 트래킹 오차 0.5픽셀 이하로 유지.\n- 합성 팀은 폭발 시 주위 배경에 떨어지는 Light Wrap(라이트 랩) 연출을 실감나게 표현해야 함. 특히 금속성 메카닉 표면에 반사광 세팅 필수.",
      mimeType: "text/plain"
    },
    {
      id: "demo3",
      name: "VFX_파이프라인_렌더링_표준_체크리스트.txt",
      content: "모든 샷 리뷰 상신 전 체크리스트:\n1. 오버스캔 10%가 올바르게 적용되어 렌더링되었는가?\n2. 알파 채널에 노이즈나 에지 디더링 현상이 없는가?\n3. 컬러 스페이스가 ACEScg로 설정되어 올바른 OD-LMT가 먹혀있는가?",
      mimeType: "text/plain"
    }
  ]);
  const [selectedFileId, setSelectedFileId] = useState<string>("demo1");
  const [googleAccessToken, setGoogleAccessToken] = useState<string>("");
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);
  const [driveSearch, setDriveSearch] = useState<string>("");
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [rawTokenInput, setRawTokenInput] = useState<string>("");

  // Gemini Intelligence States
  const [selectedAnalysisShotId, setSelectedAnalysisShotId] = useState<number>(0);
  const [userQuestionInput, setUserQuestionInput] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<{ analysisText: string; suggestedNotes: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [noteSubject, setNoteSubject] = useState<string>("제미나이 지능형 분석 피드백");
  const [isNoteSaving, setIsNoteSaving] = useState<boolean>(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<string | null>(null);

  // Expanded Shot In Shots Tab State
  const [expandedShotId, setExpandedShotId] = useState<number | null>(null);

  // Version Gemini Co-Pilot / Interactive discussion States
  const [selectedChatVersion, setSelectedChatVersion] = useState<Version | null>(null);

  const [selectedTaskSteps, setSelectedTaskSteps] = useState<string[]>([]);
  const [selectedTaskStatuses, setSelectedTaskStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedCompDueDates, setSelectedCompDueDates] = useState<string[]>([]);

  const [stepDropdownOpen, setStepDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [compDueDateDropdownOpen, setCompDueDateDropdownOpen] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  // Global Connected Project Copilot States
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [customSystemInstructions, setCustomSystemInstructions] = useState<string>(() => {
    return localStorage.getItem(`vfx_copilot_${projectId}`) || "우선순위가 가장 급한 샷이나 위험 샷을 선발해 스케줄링 가이드를 해주세요. 가이드는 엄격하게 일정 준수 측면을 체크하며, 답변 마지막에 실무자용 조치사항들을 Bullet point로 남겨주세요.";
  });
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "user" | "gemini"; text: string; timestamp: string }>>([
    {
      sender: "gemini",
      text: "안녕하세요! 프로젝트의 전체 샷리스트를 면밀하게 대조 검수하고, 정리 및 스케줄링, 병목 문제 파악을 조력하는 **Gemini VFX 전천후 Co-Pilot 에이전트**입니다. 상단 설정 부에서 외부 상황이나 특정 요구(페르소나/마일스톤 조건 등)를 먼저 부여해두신 후, 무엇이든 물어보세요!",
      timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [copilotInput, setCopilotInput] = useState<string>("");
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState<boolean>(false);

  const handleSaveInstructions = (val: string) => {
    setCustomSystemInstructions(val);
    localStorage.setItem(`vfx_copilot_${projectId}`, val);
  };

  const handleSendCopilotMessage = async (customText?: string) => {
    const textToSend = customText || copilotInput;
    if (!textToSend.trim() || isCopilotLoading) return;

    // 1. Add user bubble to view
    const timestampStr = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const userBubble = { sender: "user" as const, text: textToSend, timestamp: timestampStr };
    setCopilotMessages(prev => [...prev, userBubble]);
    if (!customText) setCopilotInput("");
    setIsCopilotLoading(true);

    try {
      // Optimize shots payload to only the metadata and tasks needed for the AI prompt
      const optimizedShots = (shots || []).map((s: any) => ({
        code: s.code,
        name: s.name,
        sg_status: s.sg_status,
        tasks: (s.tasks || []).map((t: any) => ({
          sg_task: t.sg_task,
          step: typeof t.step === "object" ? { name: t.step?.name || "" } : t.step,
          content: t.content,
          sg_status_list: t.sg_status_list,
          task_assignees: (t.task_assignees || []).map((u: any) => ({ name: u.name }))
        }))
      }));

      // 2. Fetch from backend with all available shots & custom settings in context
      const res = await fetch("/api/intelligence/project-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project?.id || projectId,
          projectName: project?.name || "진행 프로젝트",
          customSystemInstructions,
          shots: optimizedShots, // Pass down optimized lightweight shots
          chatHistory: [...copilotMessages, userBubble],
          userMessage: textToSend
        })
      });

      if (!res.ok) {
        let errMsg = "서버 응답 오류";
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      
      // 3. Add Gemini reply bubble
      setCopilotMessages(prev => [...prev, {
        sender: "gemini",
        text: data.responseText || "분석 결과를 받아올 수 없습니다.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      }]);
    } catch (e: any) {
      setCopilotMessages(prev => [...prev, {
        sender: "gemini",
        text: `죄송합니다. 대형 에이전트 연동 중 오류가 발생했습니다: ${e.message}`,
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      }]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const getVersionVideoUrl = (version: any): string => {
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
  };

  const getShotVersions = (shotItem: Shot) => {
    return versions.filter(v => {
      if (!v.entity) {
        // Fallback name-based filter if entity is absent/invalid
        const vCode = (v.code || "").toLowerCase();
        const sCode = (shotItem.code || "").toLowerCase();
        return sCode && (vCode.includes(sCode) || sCode.includes(vCode));
      }
      
      // 1. Exact ID match (widened to all types, useful when type is Asset but represents the shot core)
      if (v.entity.id === shotItem.id) return true;
      
      // 2. Exact code/name match
      if (v.entity.name === shotItem.code) return true;

      // 3. Loose name inclusion check
      const ventName = (v.entity.name || "").toLowerCase();
      const sCode = (shotItem.code || "").toLowerCase();
      if (ventName && sCode && (ventName.includes(sCode) || sCode.includes(ventName))) return true;

      const vCode = (v.code || "").toLowerCase();
      if (vCode && sCode && (vCode.includes(sCode) || sCode.includes(vCode))) return true;

      return false;
    });
  };

  const handlePlayShotVideo = async (shot: Shot) => {
    const matchedVersion = versions.find(
      (v) => v.entity?.name?.toLowerCase() === shot.code.toLowerCase()
    );
    
    let url = "";
    let title = shot.code;
    
    if (matchedVersion) {
      try {
        // Show loading state/updating feedback in title
        setActiveVideoTitle(`${shot.code} (최신 영상 보안 링크 발급 중...)`);
        setActiveVideoUrl(""); // clear old URL
        
        // Dynamic, real-time fetch to retrieve the freshest presigned S3 MP4 URL right on click
        const res = await fetch(`/api/version/${matchedVersion.id}`);
        if (!res.ok) throw new Error("플레이 갱신 로드 실패");
        const freshVersion = await res.json();
        
        url = getVersionVideoUrl(freshVersion);
        title = `${shot.code} (${freshVersion.code})`;
      } catch (err) {
        console.error("Failed to fetch fresh presigned version URL on play, falling back to local:", err);
        url = getVersionVideoUrl(matchedVersion);
        title = `${shot.code} (${matchedVersion.code})`;
      }
    } else {
      if (shot.id === 201 || shot.id === 301) {
        url = "https://assets.mixkit.co/videos/preview/mixkit-nebula-of-outer-space-background-30048-large.mp4";
      } else {
        url = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-41723-large.mp4";
      }
    }
    
    setActiveVideoUrl(url);
    setActiveVideoTitle(title);
  };

  const handlePlayVersionVideo = async (ver: Version) => {
    try {
      // Show loading state/updating feedback in title
      setActiveVideoTitle(`${ver.code} (최신 영상 보안 링크 발급 중...)`);
      setActiveVideoUrl(""); // clear old URL
      
      // Dynamic, real-time fetch to retrieve the freshest presigned S3 MP4 URL right on click
      const res = await fetch(`/api/version/${ver.id}`);
      if (!res.ok) throw new Error("버전 플레이 갱신 실패");
      const freshVersion = await res.json();
      
      const url = getVersionVideoUrl(freshVersion);
      setActiveVideoUrl(url);
      setActiveVideoTitle(freshVersion.code);
    } catch (err) {
      console.error("Failed to fetch fresh presigned version URL, playing with existing:", err);
      const url = getVersionVideoUrl(ver);
      setActiveVideoUrl(url);
      setActiveVideoTitle(ver.code);
    }
  };

  // 1. Fetch only basic project metadata on mount to show project shell immediately
  useEffect(() => {
    setProjectLoading(true);
    setErrorMsg(null);
    setShots([]);
    setVersions([]);

    fetch(`/api/project/${projectId}/detail`)
      .then((res) => res.json())
      .then((projData) => {
        if (projData && projData.error) {
          setErrorMsg(projData.error);
          setProjectLoading(false);
          return;
        }
        
        setProject(projData);
        setProjectLoading(false);
      })
      .catch((err) => {
        console.error("Error loading project detail:", err);
        setErrorMsg(err.message || "프로젝트 상세 정보를 불러오는 중 전송 오류가 발생했습니다.");
        setProjectLoading(false);
      });
  }, [projectId]);

  // 2. Perform Parallel fetching of sub-components (shots & versions) on mount
  useEffect(() => {
    if (!project) return;

    if (shots.length === 0 && !shotsLoading) {
      setShotsLoading(true);
      fetch(`/api/project/${projectId}/shots`)
        .then((res) => res.json())
        .then((shotsData) => {
          setShots(Array.isArray(shotsData) ? shotsData : []);
          setShotsLoading(false);
          // Set primary shot for analysis if not set
          if (Array.isArray(shotsData) && shotsData.length > 0) {
            setSelectedAnalysisShotId(shotsData[0].id);
          }
        })
        .catch((err) => {
          console.error("Error loading shots:", err);
          setShotsLoading(false);
        });
    }

    if (versions.length === 0 && !versionsLoading) {
      setVersionsLoading(true);
      fetch(`/api/project/${projectId}/versions`)
        .then((res) => res.json())
        .then((versionsData) => {
          setVersions(Array.isArray(versionsData) ? versionsData : []);
          setVersionsLoading(false);
        })
        .catch((err) => {
          console.error("Error loading versions:", err);
          setVersionsLoading(false);
        });
    }
  }, [projectId, project, shots.length, shotsLoading, versions.length, versionsLoading]);

  const refreshGoogleDriveWeb = async (tokenInput: string) => {
    if (!tokenInput) return;
    setIsDriveLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType)&q=mimeType='text/plain'`, {
        headers: { Authorization: `Bearer ${tokenInput}` }
      });
      if (!res.ok) throw new Error("구글 드라이브 API 인증 실패");
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const formatted = await Promise.all(
          data.files.map(async (f: any) => {
            let bodyText = "구글 워크스페이스 문서 내용 로드 완료";
            try {
              const textRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
                headers: { Authorization: `Bearer ${tokenInput}` }
              });
              if (textRes.ok) bodyText = await textRes.text();
            } catch (e) {}
            return {
              id: f.id,
              name: f.name,
              content: bodyText,
              mimeType: f.mimeType
            };
          })
         );
         setDriveFiles((prev) => [...formatted, ...prev.filter(p => !p.id.startsWith("demo"))]);
         setGoogleAccessToken(tokenInput);
         setSelectedFileId(formatted[0].id);
         alert("구글 드라이브 문서와 성공적으로 동기화되었습니다!");
      } else {
         alert("구글 드라이브에서 연동 가능한 .txt 사양문서를 찾지 못했습니다. 데모용 워크스페이스 사양이 기본 유지됩니다.");
      }
    } catch (err: any) {
      alert(`구글 드라이브 동기화 실패: ${err.message || "권한 또는 토큰 기한을 다시 확인해주세요."}`);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleAnalyzeShot = async () => {
    if (!selectedAnalysisShotId) {
      alert("분석 타겟인 샷을 선택해 주십시오.");
      return;
    }
    const matchedShot = shots.find(s => s.id === selectedAnalysisShotId);
    if (!matchedShot) return;

    const matchedFile = driveFiles.find(df => df.id === selectedFileId);

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setNoteSaveStatus(null);

    try {
      const res = await fetch("/api/intelligence/analyze-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotCode: matchedShot.code,
          shotDescription: matchedShot.description || "설명 없음",
          tasks: matchedShot.parsed_tasks || [],
          driveFileTitle: matchedFile ? matchedFile.name : "",
          driveFileContent: matchedFile ? matchedFile.content : "",
          userQuestion: userQuestionInput
        })
      });

      if (!res.ok) {
        throw new Error("서버 분석 엔진 통신 장해");
      }
      const data = await res.json();
      setAnalysisResult(data);
    } catch (e: any) {
      alert(`지능형 샷 솔루션 분석 실패: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveNoteToShotgrid = async () => {
    if (!analysisResult || !selectedAnalysisShotId) return;
    setIsNoteSaving(true);
    setNoteSaveStatus(null);

    try {
      const matchedShot = shots.find(s => s.id === selectedAnalysisShotId);
      const taskId = matchedShot?.parsed_tasks?.[0]?.id || null; 

      const res = await fetch("/api/intelligence/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: selectedAnalysisShotId,
          taskId: taskId,
          subject: noteSubject,
          content: analysisResult.suggestedNotes
        })
      });

      const data = await res.json();
      if (data.success) {
        setNoteSaveStatus("성공적으로 해당 샷/태스크의 Shotgrid Note 피드백에 저장되었습니다!");
        
        // Refresh local items
        fetch(`/api/project/${projectId}/shots`)
          .then((r) => r.json())
          .then((d) => setShots(Array.isArray(d) ? d : []));
      } else {
        setNoteSaveStatus(`실패: ${data.error || "알 수 없는 전송 실패"}`);
      }
    } catch (e: any) {
      setNoteSaveStatus(`전송 에러: ${e.message}`);
    } finally {
      setIsNoteSaving(false);
    }
  };

  const handleOpenVersionChat = (ver: Version) => {
    setSelectedChatVersion(ver);
  };

  const renderTaskStatusIcon = (status: string) => {
    const code = (status || "").toLowerCase().trim();
    const style = getStatusStyle(code);
    return (
      <span 
        className={`inline-flex items-center justify-center px-1.5 py-0.5 ml-1.5 rounded text-[8px] font-black tracking-wide uppercase leading-none border shadow-3xs ${style.bg} ${style.text} ${style.border}`}
        title={style.label}
      >
        {style.label}
      </span>
    );
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

  if (projectLoading || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase font-mono">Loading specs...</p>
      </div>
    );
  }

  // Extract unique pipeline steps (e.g. "Layout", "Animation") across all loaded shots
  const availableSteps = (Array.from(
    new Set(
      shots
        .flatMap((s) => s.parsed_tasks || [])
        .map((t) => (t.step || "").trim())
        .filter(Boolean)
    )
  ) as string[]).sort((a, b) => a.localeCompare(b, "ko"));

  // Extract unique statuses within currently selected task steps (or across all tasks if none selected)
  const availableStatuses = (Array.from(
    new Set(
      shots
        .flatMap((s) => s.parsed_tasks || [])
        .filter((t) => selectedTaskSteps.length === 0 || selectedTaskSteps.map(s => s.toLowerCase()).includes((t.step || "").toLowerCase()))
        .map((t) => (t.status || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ) as string[]).sort();

  // Extract unique assignees across all loaded shots
  const availableAssignees = (Array.from(
    new Set(
      shots
        .flatMap((s) => s.parsed_tasks || [])
        .map((t) => cleanAssigneeName(t.assignee_name).trim())
        .filter(Boolean)
    )
  ) as string[]).sort((a, b) => a.localeCompare(b, "ko"));

  // Helper to extract COMP task due date for a shot
  const getShotCompDueDate = (shot: Shot): string | null => {
    const compTasks = (shot.parsed_tasks || []).filter((t) => {
      const stepName = (t.step || "").toLowerCase();
      const content = (t.content || "").toLowerCase();
      const sgTask = (t.sg_task || "").toLowerCase();
      return stepName.includes("comp") || content.includes("comp") || sgTask.includes("comp");
    });
    if (compTasks.length === 0) return null;
    const dates = compTasks.map(t => t.due_date).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    dates.sort();
    return dates[dates.length - 1]; // latest comp due date
  };

  // Extract unique COMP due dates across all loaded shots
  const availableCompDueDates = Array.from(
    new Set(
      shots
        .map((s) => getShotCompDueDate(s))
        .filter(Boolean)
    )
  ).sort() as string[];

  // Helper to translate status codes into human friendly text
  const getStatusLabelText = (status: string) => {
    return getStatusStyle(status).label;
  };

  // Helper toggle handlers
  const toggleStepFilter = (step: string) => {
    setSelectedTaskSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const toggleStatusFilter = (status: string) => {
    setSelectedTaskStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleAssigneeFilter = (assignee: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assignee) ? prev.filter((a) => a !== assignee) : [...prev, assignee]
    );
  };

  const toggleCompDueDateFilter = (date: string) => {
    setSelectedCompDueDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleClearAllFilters = () => {
    setSelectedTaskSteps([]);
    setSelectedTaskStatuses([]);
    setSelectedAssignees([]);
    setSelectedCompDueDates([]);
  };

  const isFiltered =
    selectedTaskSteps.length > 0 ||
    selectedTaskStatuses.length > 0 ||
    selectedAssignees.length > 0 ||
    selectedCompDueDates.length > 0;

  // Filter the actual shots
  const filteredShots = shots.filter((shot) => {
    // 1. standard filters check (only check if standard filters are active)
    const hasStandardActive = selectedTaskSteps.length > 0 || selectedTaskStatuses.length > 0 || selectedAssignees.length > 0;
    const matchesStandard = !hasStandardActive || (shot.parsed_tasks || []).some((task) => {
      const stepMatch = selectedTaskSteps.length === 0 || selectedTaskSteps.map(s => s.toLowerCase()).includes((task.step || "").toLowerCase());
      const statusMatch = selectedTaskStatuses.length === 0 || selectedTaskStatuses.map(s => s.toLowerCase()).includes((task.status || "").toLowerCase());
      const assigneeMatch = selectedAssignees.length === 0 || selectedAssignees.includes(cleanAssigneeName(task.assignee_name));
      return stepMatch && statusMatch && assigneeMatch;
    });

    // 2. comp due date filter check
    const shotCompDueDate = getShotCompDueDate(shot);
    const matchesCompDueDate = selectedCompDueDates.length === 0 || (shotCompDueDate && selectedCompDueDates.includes(shotCompDueDate));

    return matchesStandard && matchesCompDueDate;
  });

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
        <div className="flex items-center gap-2">
          {/* 글로벌 제미나이 코파일럿 버튼 */}
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-[11px] px-3.5 py-2 rounded-2xl shadow-sm hover:shadow transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
          >
            <Brain className="w-4 h-4 animate-pulse text-indigo-100" />
            <span>GEMINI CO-PILOT</span>
            <span className="bg-indigo-500/50 text-[8px] px-1 rounded text-indigo-100 font-extrabold uppercase scale-90 text-[7px]">ACTIVE</span>
          </button>

          <span className="px-2.5 py-2 rounded-2xl text-[10px] tracking-wider font-extrabold uppercase border bg-emerald-50 text-emerald-700 border-emerald-100">
            {project.sg_status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setActiveTab("shots")}
            className={`flex-1 py-3 text-center border-b-2 font-black text-xs transition uppercase tracking-wider cursor-pointer inline-flex items-center justify-center ${
              activeTab === "shots" ? "border-blue-600 text-blue-600" : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <Film className="w-3.5 h-3.5 mr-1.5 inline-block" />
            <span>SHOTS</span>
            {!shotsLoading && shots.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "shots" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-600"
              }`}>
                {shots.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("versions")}
            className={`flex-1 py-3 text-center border-b-2 font-black text-xs transition uppercase tracking-wider cursor-pointer inline-flex items-center justify-center ${
              activeTab === "versions" ? "border-blue-600 text-blue-600" : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5 mr-1.5 inline-block" />
            <span>VERSIONS</span>
            {!versionsLoading && versions.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "versions" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-600"
              }`}>
                {versions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("intelligence")}
            className={`flex-1 py-3 text-center border-b-2 font-black text-xs transition uppercase tracking-wider cursor-pointer inline-flex items-center justify-center ${
              activeTab === "intelligence" ? "border-blue-600 text-blue-600" : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <Brain className="w-3.5 h-3.5 mr-1.5 inline-block text-indigo-500 animate-pulse" />
            <span>AI LAB & DRIVE</span>
            <span className="ml-2 px-1 rounded bg-indigo-100 text-indigo-700 text-[8px] font-extrabold uppercase shrink-0">
              NEW
            </span>
          </button>
        </div>

        {/* Tab 1: Shots */}
        {activeTab === "shots" && (
          <div className="space-y-4">
            {shotsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-mono font-bold text-stone-400 tracking-wider">LOADING SHOTS...</p>
              </div>
            ) : (
              <>
                {/* Back-drop Overlay for Dropdowns */}
                {(stepDropdownOpen || statusDropdownOpen || assigneeDropdownOpen || compDueDateDropdownOpen) && (
                  <div
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => {
                      setStepDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setAssigneeDropdownOpen(false);
                      setCompDueDateDropdownOpen(false);
                    }}
                  />
                )}

                {/* Total Count Indicators */}
                {shots.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 px-1.5 py-0.5 bg-stone-50/40 rounded-xl border border-stone-100/30">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                      {isFiltered ? (
                        <span>
                          필터링된 결과 <strong className="text-blue-600">{filteredShots.length}</strong>개 / 총 <strong className="text-stone-850">{shots.length}</strong>개의 샷이 있습니다.
                        </span>
                      ) : (
                        <span>
                          이 프로젝트에 총 <strong className="text-blue-600">{shots.length}</strong>개의 샷이 등록되어 있습니다.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Beautiful Advanced Multi-Filter Controls */}
                {shots.length > 0 && (
                  <div className="bg-stone-55/80 border border-stone-200/95 rounded-3xl p-4 flex flex-col gap-4 shadow-sm animate-fade-in mb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 1. 태스크 필터 멀티 드롭다운 */}
                      <div className={`relative flex flex-col space-y-1 ${stepDropdownOpen ? "z-30" : "z-20"}`}>
                        <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">
                          태스크 단계 (Task Step)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStepDropdownOpen(!stepDropdownOpen);
                            setStatusDropdownOpen(false);
                            setAssigneeDropdownOpen(false);
                            setCompDueDateDropdownOpen(false);
                          }}
                          className="bg-white border border-stone-205 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-stone-800 font-extrabold transition shadow-sm cursor-pointer w-full text-left flex justify-between items-center"
                        >
                          <span className="truncate">
                            {selectedTaskSteps.length === 0
                              ? "모든 태스크"
                              : `태스크 ${selectedTaskSteps.length}개 선택됨`}
                          </span>
                          <span className="text-stone-400 text-[10px] ml-1 flex-shrink-0">
                            {stepDropdownOpen ? "▲" : "▼"}
                          </span>
                        </button>
                        {stepDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-2 space-y-1 animate-fade-in min-w-[200px]">
                            <div className="flex justify-between items-center px-1.5 py-1 border-b border-stone-100 mb-1">
                              <button
                                type="button"
                                onClick={() => setSelectedTaskSteps([])}
                                className="text-[9px] font-black text-stone-400 hover:text-stone-700 uppercase"
                              >
                                모두 해제
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedTaskSteps([...availableSteps])}
                                className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase"
                              >
                                전체 선택
                              </button>
                            </div>
                            {availableSteps.map((step) => {
                              const isChecked = selectedTaskSteps.includes(step);
                              return (
                                <button
                                  type="button"
                                  key={step}
                                  onClick={() => toggleStepFilter(step)}
                                  className="w-full text-left flex items-center space-x-2 px-2 py-1.5 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 cursor-pointer select-none transition"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="accent-blue-600 h-3 w-3 rounded border-stone-300 pointer-events-none"
                                  />
                                  <span className="truncate">{step}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 2. 상태 필터 멀티 드롭다운 */}
                      <div className={`relative flex flex-col space-y-1 ${statusDropdownOpen ? "z-30" : "z-20"}`}>
                        <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">
                          태스크 상태 (Task Status)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusDropdownOpen(!statusDropdownOpen);
                            setStepDropdownOpen(false);
                            setAssigneeDropdownOpen(false);
                            setCompDueDateDropdownOpen(false);
                          }}
                          className="bg-white border border-stone-205 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-stone-800 font-extrabold transition shadow-sm cursor-pointer w-full text-left flex justify-between items-center"
                        >
                          <span className="truncate">
                            {selectedTaskStatuses.length === 0
                              ? "모든 상태"
                              : `상태 ${selectedTaskStatuses.length}개 선택됨`}
                          </span>
                          <span className="text-stone-400 text-[10px] ml-1 flex-shrink-0">
                            {statusDropdownOpen ? "▲" : "▼"}
                          </span>
                        </button>
                        {statusDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-2 space-y-1 animate-fade-in min-w-[200px]">
                            <div className="flex justify-between items-center px-1.5 py-1 border-b border-stone-100 mb-1">
                              <button
                                type="button"
                                onClick={() => setSelectedTaskStatuses([])}
                                className="text-[9px] font-black text-stone-400 hover:text-stone-700 uppercase"
                              >
                                모두 해제
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedTaskStatuses([...availableStatuses])}
                                className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase"
                              >
                                전체 선택
                              </button>
                            </div>
                            {availableStatuses.map((status) => {
                              const isChecked = selectedTaskStatuses.includes(status);
                              return (
                                <button
                                  type="button"
                                  key={status}
                                  onClick={() => toggleStatusFilter(status)}
                                  className="w-full text-left flex items-center space-x-2 px-2 py-1.5 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 cursor-pointer select-none transition"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="accent-blue-600 h-3 w-3 rounded border-stone-300 pointer-events-none"
                                  />
                                  <span className="truncate">{getStatusLabelText(status)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 3. 작업자 필터 멀티 드롭다운 */}
                      <div className={`relative flex flex-col space-y-1 ${assigneeDropdownOpen ? "z-30" : "z-20"}`}>
                        <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">
                          작업자 배정 (Assigned To)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAssigneeDropdownOpen(!assigneeDropdownOpen);
                            setStepDropdownOpen(false);
                            setStatusDropdownOpen(false);
                            setCompDueDateDropdownOpen(false);
                          }}
                          className="bg-white border border-stone-205 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-stone-800 font-extrabold transition shadow-sm cursor-pointer w-full text-left flex justify-between items-center"
                        >
                          <span className="truncate">
                            {selectedAssignees.length === 0
                              ? "모든 작업자"
                              : `작업자 ${selectedAssignees.length}명 선택됨`}
                          </span>
                          <span className="text-stone-400 text-[10px] ml-1 flex-shrink-0">
                            {assigneeDropdownOpen ? "▲" : "▼"}
                          </span>
                        </button>
                        {assigneeDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-2 space-y-1 animate-fade-in min-w-[200px]">
                            <div className="flex justify-between items-center px-1.5 py-1 border-b border-stone-100 mb-1">
                              <button
                                type="button"
                                onClick={() => setSelectedAssignees([])}
                                className="text-[9px] font-black text-stone-400 hover:text-stone-700 uppercase"
                              >
                                모두 해제
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedAssignees([...availableAssignees])}
                                className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase"
                              >
                                전체 선택
                              </button>
                            </div>
                            {availableAssignees.length === 0 ? (
                              <div className="text-stone-400 text-center text-[10px] font-bold py-3.5 italic">
                                검색된 작업자가 없습니다.
                              </div>
                            ) : (
                              availableAssignees.map((assignee) => {
                                const isChecked = selectedAssignees.includes(assignee);
                                return (
                                  <button
                                    type="button"
                                    key={assignee}
                                    onClick={() => toggleAssigneeFilter(assignee)}
                                    className="w-full text-left flex items-center space-x-2 px-2 py-1.5 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 cursor-pointer select-none transition"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      className="accent-blue-600 h-3 w-3 rounded border-stone-300 pointer-events-none"
                                    />
                                    <span className="truncate">{assignee}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4. COMP Due Date 필터 멀티 드롭다운 */}
                      <div className={`relative flex flex-col space-y-1 ${compDueDateDropdownOpen ? "z-30" : "z-20"}`}>
                        <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">
                          COMP 마감일 (COMP Due Date)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompDueDateDropdownOpen(!compDueDateDropdownOpen);
                            setStepDropdownOpen(false);
                            setStatusDropdownOpen(false);
                            setAssigneeDropdownOpen(false);
                          }}
                          className="bg-white border border-stone-205 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-stone-800 font-extrabold transition shadow-sm cursor-pointer w-full text-left flex justify-between items-center"
                        >
                          <span className="truncate">
                            {selectedCompDueDates.length === 0
                              ? "모든 마감일"
                              : `마감일 ${selectedCompDueDates.length}개 선택됨`}
                          </span>
                          <span className="text-stone-400 text-[10px] ml-1 flex-shrink-0">
                            {compDueDateDropdownOpen ? "▲" : "▼"}
                          </span>
                        </button>
                        {compDueDateDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-2 space-y-1 animate-fade-in min-w-[200px]">
                            <div className="flex justify-between items-center px-1.5 py-1 border-b border-stone-100 mb-1">
                              <button
                                type="button"
                                onClick={() => setSelectedCompDueDates([])}
                                className="text-[9px] font-black text-stone-400 hover:text-stone-700 uppercase"
                              >
                                모두 해제
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCompDueDates([...availableCompDueDates])}
                                className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase"
                              >
                                전체 선택
                              </button>
                            </div>
                            {availableCompDueDates.length === 0 ? (
                              <div className="text-stone-400 text-center text-[10px] font-bold py-3.5 italic">
                                등록된 마감일이 없습니다.
                              </div>
                            ) : (
                              availableCompDueDates.map((date) => {
                                const isChecked = selectedCompDueDates.includes(date);
                                return (
                                  <button
                                    type="button"
                                    key={date}
                                    onClick={() => toggleCompDueDateFilter(date)}
                                    className="w-full text-left flex items-center space-x-2 px-2 py-1.5 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 cursor-pointer select-none transition"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      className="accent-blue-600 h-3 w-3 rounded border-stone-300 pointer-events-none"
                                    />
                                    <span className="truncate">{date}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Filter Active Badge Chips */}
                    {isFiltered && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-200/60 mt-1">
                        {selectedTaskSteps.map((step) => (
                          <span
                            key={step}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm"
                          >
                            <span>태스크: {step}</span>
                            <button
                              type="button"
                              onClick={() => toggleStepFilter(step)}
                              className="hover:text-rose-600 ml-1.5 transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {selectedTaskStatuses.map((status) => (
                          <span
                            key={status}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-55 text-amber-800 border border-amber-100 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm"
                          >
                            <span>상태: {getStatusLabelText(status)}</span>
                            <button
                              type="button"
                              onClick={() => toggleStatusFilter(status)}
                              className="hover:text-rose-600 ml-1.5 transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {selectedAssignees.map((assignee) => (
                          <span
                            key={assignee}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm"
                          >
                            <span>작업자: {assignee}</span>
                            <button
                              type="button"
                              onClick={() => toggleAssigneeFilter(assignee)}
                              className="hover:text-rose-600 ml-1.5 transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {selectedCompDueDates.map((date) => (
                          <span
                            key={date}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm"
                          >
                            <span>COMP 마감일: {date}</span>
                            <button
                              type="button"
                              onClick={() => toggleCompDueDateFilter(date)}
                              className="hover:text-rose-600 ml-1.5 transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}

                        <button
                          type="button"
                          onClick={handleClearAllFilters}
                          className="inline-flex items-center text-[9px] font-black text-rose-650 hover:text-rose-800 uppercase tracking-widest bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-100 transition cursor-pointer ml-auto"
                        >
                          필터 초기화 (Reset)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {filteredShots.map((shot) => {
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
                      <div 
                        onClick={() => setExpandedShotId(expandedShotId === shot.id ? null : shot.id)}
                        className="flex items-start space-x-4 cursor-pointer hover:bg-stone-50/40 p-1.5 rounded-2xl -m-1.5 transition select-none"
                        title="클릭하여 버전 목록 보기"
                      >
                        {/* Left Thumbnail Column */}
                        <div className="flex flex-col items-center space-y-2 w-24 flex-shrink-0">
                          <div 
                            className="w-24 h-16 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group relative transition"
                          >
                            {shot.sg_org_thumbnail ? (
                              <img
                                src={shot.sg_org_thumbnail}
                                alt={shot.code}
                                className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : shot.image ? (
                              <img
                                src={shot.image}
                                alt={shot.code}
                                className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-stone-300" />
                            )}
                            
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex flex-col items-center justify-center transition duration-200">
                              <Film className="w-4 h-4 text-white/0 group-hover:text-white/100 drop-shadow transition duration-200 mb-0.5" />
                              <span className="text-[7.5px] text-white/0 group-hover:text-white/100 font-extrabold uppercase tracking-wide transition duration-200">
                                {getShotVersions(shot).length} Ver
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-stone-800 text-center break-all whitespace-normal w-full tracking-wider">
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

                      {/* Versions Accordion Bar */}
                      <div className="border-t border-stone-150/60 pt-2 flex flex-col">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setExpandedShotId(expandedShotId === shot.id ? null : shot.id)}
                            className="inline-flex items-center space-x-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-850 tracking-wider uppercase bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            {expandedShotId === shot.id ? (
                              <>
                                <span>버전 리스트 닫기 ▲</span>
                              </>
                            ) : (
                              <>
                                <span>버전 리스트 열기 ({getShotVersions(shot).length}) ▼</span>
                              </>
                            )}
                          </button>
                        </div>

                        {expandedShotId === shot.id && (
                          <div className="mt-3 bg-stone-50 border border-stone-200/80 rounded-2xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-stone-200/50 pb-1.5 shrink-0">
                              <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest flex items-center">
                                <Film className="w-3 h-3 text-indigo-500 mr-1" /> 이 샷의 버전 목록 (Versions)
                              </span>
                              <span className="text-[9px] bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded uppercase">
                                {getShotVersions(shot).length} Releases
                              </span>
                            </div>

                            {getShotVersions(shot).length === 0 ? (
                              <p className="text-[10px] text-stone-400 font-bold italic text-center py-4">이 샷 하위에 등록된 영상 버전을 감지하지 못했습니다.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {getShotVersions(shot).map((ver) => (
                                  <div 
                                    key={ver.id} 
                                    onClick={() => handlePlayVersionVideo(ver)}
                                    className="bg-white border border-stone-200 rounded-xl p-2 flex items-center space-x-3 hover:border-indigo-400 hover:bg-indigo-50/15 cursor-pointer active:scale-[0.99] transition shadow-sm group/ver"
                                    title="클릭하여 미디어 플레이어 재생"
                                  >
                                    {/* Version Thumbnail / Preview */}
                                    <div
                                      className="w-14 h-9 bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 relative overflow-hidden transition group-hover/ver:border-indigo-400"
                                    >
                                      {ver.image ? (
                                        <>
                                          <img
                                            src={ver.image}
                                            alt={ver.code}
                                            className="object-cover w-full h-full group-hover/ver:scale-105 transition"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover/ver:bg-black/20 flex items-center justify-center transition">
                                            <PlayCircle className="w-3.5 h-3.5 text-white/0 group-hover/ver:text-white/90 drop-shadow transition" />
                                          </div>
                                        </>
                                      ) : (
                                        <PlayCircle className="w-4 h-4 text-stone-400 fill-stone-100 group-hover/ver:text-indigo-500 transition" />
                                      )}
                                    </div>

                                    {/* Version Name / Information */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-[10.5px] font-black text-stone-850 break-all whitespace-normal group-hover/ver:text-indigo-800 transition">{ver.code}</h4>
                                      <div className="flex items-center space-x-1.5 mt-0.5">
                                        <span className="px-1 py-0.1 space bg-amber-50 text-amber-700 border border-amber-100 rounded text-[7.5px] font-extrabold uppercase">
                                          {ver.sg_status_list ? ver.sg_status_list.toUpperCase() : "REV"}
                                        </span>
                                        <span className="text-[9px] text-stone-400 font-mono font-bold">v{ver.sg_version_number || 1}</span>
                                      </div>
                                    </div>

                                    {/* Co-Pilot intelligence interaction buttons */}
                                    <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenVersionChat(ver)}
                                        className="bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg px-2 py-1 text-[9.5px] font-black uppercase tracking-wider transition flex items-center space-x-1 cursor-pointer shadow-sm shadow-indigo-100"
                                      >
                                        <Brain className="w-2.5 h-2.5" />
                                        <span>AI 분석</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onNavigate("version_detail", { versionId: ver.id })}
                                        className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg p-1.5 transition text-blue-600 hover:text-blue-800 cursor-pointer"
                                        title="Detail view"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {shots.length > 0 && filteredShots.length === 0 && (
                  <div className="bg-white border border-stone-200 rounded-3xl p-10 text-center text-stone-500 shadow-sm">
                    <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-stone-700">지정한 필터를 만족하는 샷 검색 결과가 없습니다.</p>
                    <button
                      onClick={handleClearAllFilters}
                      className="mt-3 inline-flex items-center text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition cursor-pointer"
                    >
                      모든 샷 보기
                    </button>
                  </div>
                )}

                {shots.length === 0 && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 shadow-sm">
                    <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold">프로젝트 하위에 등록된 샷이 없습니다.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Versions */}
        {activeTab === "versions" && (
          <div className="space-y-3">
            {versionsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-mono font-bold text-stone-400 tracking-wider">LOADING VERSIONS...</p>
              </div>
            ) : (
              <>
                {/* Total Count Indicators */}
                {versions.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 px-1.5 py-0.5 bg-stone-50/40 rounded-xl border border-stone-100/30">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      <span>
                        이 프로젝트에 총 <strong className="text-emerald-600">{versions.length}</strong>개의 영상 버전이 등록되어 있습니다.
                      </span>
                    </div>
                  </div>
                )}

                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="bg-white border border-stone-200 rounded-3xl p-4 flex items-center space-x-4 shadow-sm hover:border-stone-300 transition"
                  >
                    <div 
                      onClick={() => handlePlayVersionVideo(ver)}
                      className="w-20 h-12 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 relative overflow-hidden shadow-inner cursor-pointer hover:border-blue-400 group transition"
                    >
                      {ver.image ? (
                        <>
                          <img
                            src={ver.image}
                            alt={ver.code}
                            className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition duration-200">
                            <PlayCircle className="w-5 h-5 text-white/0 group-hover:text-white/90 drop-shadow-md transition duration-200" />
                          </div>
                        </>
                      ) : (
                        <PlayCircle className="w-5 h-5 text-stone-400 fill-stone-100 group-hover:text-blue-500 transition" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-stone-400 uppercase font-black tracking-widest block mb-0.5">
                        {ver.entity?.name || "No Entity"}
                      </span>
                      <h3 className="text-xs font-black text-stone-850 break-all whitespace-normal">{ver.code}</h3>
                      <div className="flex justify-between items-center mt-1">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-100">
                          {ver.sg_status_list ? ver.sg_status_list.toUpperCase() : "REV"}
                        </span>
                        <span className="text-[9px] text-stone-450 font-mono">v{ver.sg_version_number || 1}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenVersionChat(ver)}
                        className="bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-wider transition flex items-center space-x-1 cursor-pointer shadow-sm shadow-indigo-150 animate-pulse"
                      >
                        <Brain className="w-3 h-3" />
                        <span>AI 분석</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate("version_detail", { versionId: ver.id })}
                        className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl p-2.5 transition text-blue-600 hover:text-blue-800"
                        title="Detail view"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {versions.length === 0 && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 shadow-sm">
                    <PlayCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold">프로젝트 하위에 등록된 영상 버젼이 없습니다.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: Intelligence & Drive */}
        {activeTab === "intelligence" && (
          <div className="space-y-6">
            {/* Header intro of intelligence lab */}
            <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-start space-x-3.5">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-indigo-200 shadow-md shrink-0">
                    <Brain className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-stone-900 tracking-tight flex items-center">
                      제미나이 지능형 공정 랩 (Gemini AI & Workspace Lab)
                    </h2>
                    <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                      구글 드라이브 사양서(스펙 문서, 회의록, 디렉션 노트)와 구성된 ShotGrid 데이터를 실시간 대조하여,<br />
                      발견된 요구조건 오차를 피드백하고 각 아티스트 공정(MM, ANI, LIGHT, COMP)에 필요한 최적의 해결 솔루션을 제미나이가 어드바이징합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Split Grid Panel: Left Google Drive, Right Workspace Doc Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
              
              {/* Left Panel: Google Drive Files List (Col 5) */}
              <div className="lg:col-span-5 flex flex-col bg-white border border-stone-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center">
                    <FileText className="w-4 h-4 text-blue-600 mr-1.5" /> 구글 드라이브 보관함
                  </h3>
                  <button 
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-800 tracking-wide uppercase flex items-center space-x-0.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 mr-0.5 animate-spin-slow" />
                    <span>OAuth 인증</span>
                  </button>
                </div>

                {/* Optional Raw Token Injection Panel */}
                {showTokenInput && (
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-600 uppercase">Google OAuth Access Token</span>
                      <span className="text-[9px] text-amber-600 font-extrabold uppercase">Manual sync</span>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-normal">
                      개발 보안 샌드박스에서 구글 계정으로 연동 하려면, 획득한 Google Drive OAuth 토큰을 기입하십시오. 
                      미입력 시 에피소드 고화질 VFX 템플릿 문서(데모 모드)가 활성화되어 가상 검사할 수 있습니다.
                    </p>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        placeholder="ya29.a0AfB_..."
                        value={rawTokenInput}
                        onChange={(e) => setRawTokenInput(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-[10px] font-mono focus:outline-none"
                      />
                      <button
                        onClick={() => refreshGoogleDriveWeb(rawTokenInput)}
                        disabled={isDriveLoading}
                        className="bg-blue-600 text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-blue-500 transition cursor-pointer disabled:opacity-50"
                      >
                        {isDriveLoading ? "로딩..." : "동기화"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Drive Files Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="드라이브 스펙 문서명 검색..."
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
                  />
                </div>

                {/* List Container */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {driveFiles
                    .filter(df => df.name.toLowerCase().includes(driveSearch.toLowerCase()))
                    .map((file) => {
                      const isSelected = selectedFileId === file.id;
                      const isDemo = file.id.startsWith("demo");
                      return (
                        <button
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-start space-x-2.5 ${
                            isSelected
                              ? "bg-blue-50/70 border-blue-200 text-blue-900"
                              : "bg-stone-50/55 hover:bg-stone-50 border-stone-150 text-stone-700"
                          }`}
                        >
                          <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? "text-blue-600" : "text-stone-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold truncate pr-2">{file.name}</p>
                            <span className={`text-[9px] font-extrabold ${isDemo ? "text-indigo-500" : "text-emerald-600"}`}>
                              {isDemo ? "VFX 제작 가이드라인 (데모)" : "Google Drive 실시간"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Right Panel: Content Viewer (Col 7) */}
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-3xl p-5 shadow-sm flex flex-col h-[340px]">
                <div className="border-b border-stone-100 pb-3 mb-3 shrink-0 flex items-center justify-between">
                  <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center">
                    <Eye className="w-4 h-4 text-emerald-600 mr-1.5" /> 연동 문서 실시간 사양 검회
                  </h3>
                  <span className="text-[9px] bg-stone-100 border border-stone-200 text-stone-500 font-mono px-2 py-0.5 rounded font-bold">
                    DOCUMENT VIEW
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto bg-stone-50/50 rounded-2xl p-4 border border-stone-100">
                  {(() => {
                    const matched = driveFiles.find(df => df.id === selectedFileId);
                    if (!matched) {
                      return <p className="text-xs text-stone-400 text-center py-20">조회할 문서를 왼쪽 목록에서 선택해주십시오.</p>;
                    }
                    return (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-extrabold text-stone-950 font-mono underline decoration-blue-500/40">{matched.name}</h4>
                        <p className="text-[11px] text-stone-600 leading-relaxed font-mono whitespace-pre-wrap">{matched.content}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* AI Analysis Playground Section */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
              <div className="flex items-center space-x-2 border-b border-stone-100 pb-4">
                <Brain className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                    제미나이 샷 파이프라인 분석 서비스 (Gemini VFX Shot Solutions Portal)
                  </h3>
                  <p className="text-[10px] text-stone-400 font-bold tracking-wide uppercase">
                    Shot matching engine • gemini-2.5-flash
                  </p>
                </div>
              </div>

              {/* Selection inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Shot */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">분석 타겟 샷 선택 (SELECT TARGET SHOT)</label>
                  <select
                    value={selectedAnalysisShotId}
                    onChange={(e) => {
                      setSelectedAnalysisShotId(parseInt(e.target.value));
                      setAnalysisResult(null);
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-3 text-xs text-stone-800 font-bold focus:outline-none"
                  >
                    <option value={0} disabled>-- 분석할 샷을 고르십시오 --</option>
                    {shots.map((shot) => (
                      <option key={shot.id} value={shot.id}>
                        🎞️ {shot.code} ({shot.parsed_tasks?.length || 0}개 공정 진행 중)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reference File details */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">대조할 드라이브 사양 문서</label>
                  <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl px-3.5 py-3 text-xs text-stone-800 flex items-center space-x-2 font-bold text-indigo-950">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {driveFiles.find(df => df.id === selectedFileId)?.name || "선택된 드라이브 파일 없음"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Prompt / Special Concern Area */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  VFX 수퍼바이저 지시 피드백 사항 (옵션)
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="예: 라이트 랩 밀도 피드백에 대해 디테일 가이드를 제시해주세요..."
                    value={userQuestionInput}
                    onChange={(e) => setUserQuestionInput(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleAnalyzeShot}
                  disabled={isAnalyzing || shots.length === 0}
                  className="w-full sm:w-auto px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>제미나이가 공정 가이드를 매칭 중입니다...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 animate-pulse" />
                      <span>제미나이 지능형 공정 가이드 분석 시작</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Result Output Section */}
              {isAnalyzing && (
                <div className="border border-indigo-200 rounded-2xl p-6 bg-indigo-50/30 flex flex-col items-center justify-center space-y-3.5">
                  <Sparkles className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-bold text-indigo-900 text-center">
                    선택한 Google Drive 지시사항과 ShotGrid 샷의 비주얼 메타데이터를 매칭 중입니다.
                  </p>
                  <p className="text-[10px] text-stone-500 font-medium text-center">
                    공정(VFX Pipeline steps) 간 위반사항 점검 및 아티스트 조언을 도출하는 중입니다.
                  </p>
                </div>
              )}

              {analysisResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
                  {/* Left Column: Solution guidelines with markdown-body style */}
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3 shadow-inner overflow-hidden flex flex-col">
                    <div className="flex items-center space-x-1.5 border-b border-stone-200 pb-2.5 shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                      <h4 className="text-[11px] font-black text-stone-900 uppercase tracking-wide">1. 제미나이 샷별 솔루션 및 지침</h4>
                    </div>
                    <div className="text-[11px] text-stone-700 leading-relaxed font-mono whitespace-pre-wrap flex-1 overflow-y-auto max-h-96">
                      {analysisResult.analysisText}
                    </div>
                  </div>

                  {/* Right Column: Suggested Review Notes for Shotgrid */}
                  <div className="bg-amber-50/20 border border-amber-200/50 rounded-2xl p-5 flex flex-col space-y-3">
                    <div className="flex items-center space-x-1.5 border-b border-amber-200 pb-2.5 shrink-0">
                      <Share2 className="w-3.5 h-3.5 text-amber-600" />
                      <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-wide">2. 아티스트 피드백 노트 초안</h4>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-white border border-amber-100 rounded-xl p-3 h-52">
                      <textarea
                        rows={8}
                        value={analysisResult.suggestedNotes}
                        onChange={(e) => setAnalysisResult({ ...analysisResult, suggestedNotes: e.target.value })}
                        className="w-full h-full bg-transparent text-[11px] text-stone-800 leading-relaxed font-mono focus:outline-none resize-none"
                      />
                    </div>

                    {/* Sync to ShotGrid Section */}
                    <div className="bg-white border border-stone-150 p-4 rounded-2xl space-y-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-stone-700 uppercase tracking-widest flex items-center">
                          <Database className="w-3.5 h-3.5 mr-1 text-emerald-600" /> SHOTGRID DB 연동 게이트
                        </span>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded uppercase">
                          ACTIVE Sync
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        위의 피드백 텍스트를 대상 샷 첫 번째 태스크의 Shotgrid Note 기입 창에 직접 전원 입력 및 전송 처리합니다.
                      </p>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <input
                          type="text"
                          value={noteSubject}
                          onChange={(e) => setNoteSubject(e.target.value)}
                          placeholder="노트 제목 입력..."
                          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl text-[11px] px-3 py-2 font-bold focus:outline-none font-mono"
                        />
                        <button
                          onClick={handleSaveNoteToShotgrid}
                          disabled={isNoteSaving}
                          className="bg-emerald-600 text-white rounded-xl text-xs font-bold px-4 py-2.5 hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center space-x-1"
                        >
                          {isNoteSaving ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>전송 중...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              <span>노트 최종 등록</span>
                            </>
                          )}
                        </button>
                      </div>

                      {noteSaveStatus && (
                        <div className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-800 px-3 py-2 rounded-xl font-bold flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          {noteSaveStatus}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Popover / Overlay Video Player Modal */}
      {activeVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
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
              >
                동영상을 지원하지 않는 웹 브라우저입니다.
              </video>
            </div>

            {/* Footer */}
            <div className="flex justify-end mt-4">
              <p className="text-[10px] text-stone-450 uppercase tracking-widest font-mono font-bold">
                Proxy Playback Mode • ShotGrid Integration Web App
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Gemini Version Video & Frame Analysis Chat Co-Pilot Modal */}
      {selectedChatVersion && (
        <VersionChatModal
          version={selectedChatVersion}
          onClose={() => setSelectedChatVersion(null)}
          getVersionVideoUrl={getVersionVideoUrl}
          handlePlayVersionVideo={handlePlayVersionVideo}
          shots={shots}
        />
      )}

      {/* 글로벌 프로젝트 제미나이 마스터 에이전트 드로워 */}
      {isCopilotOpen && (
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setIsCopilotOpen(false)}
            className="fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-xs transition-opacity animate-fade-in"
          />
          
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md md:max-w-lg bg-white border-l border-stone-200 shadow-2xl flex flex-col animate-[slideIn_0.22s_ease-out]">
            {/* 1. 드로워 헤더 */}
            <div className="p-4 border-b border-stone-150 bg-stone-50/90 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-600 rounded-2xl p-2 shadow-sm shrink-0">
                  <Brain className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-stone-900 tracking-tight flex items-center gap-1.5 leading-none">
                    <span>GEMINI MASTER CO-PILOT</span>
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1 py-0.5 rounded font-mono scale-90 shrink-0 text-[7px]">VFX PRO</span>
                  </h3>
                  <p className="text-[9.5px] font-bold text-stone-500 leading-tight mt-1 truncate">전체 공정 요약 및 스케줄링 조율, 병목 파악 에이전트</p>
                </div>
              </div>
              <button
                onClick={() => setIsCopilotOpen(false)}
                className="text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full p-2 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. 대화 세선 및 인셉션 가이드 (Scrollable Box) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* ⚙️ 시스템 가이드/지침 설정 아코디언 */}
              <div className="bg-stone-50/80 border border-stone-200 rounded-2xl overflow-hidden shadow-3xs">
                <button
                  type="button"
                  onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
                  className="w-full flex items-center justify-between p-3.5 text-left font-black text-[11px] text-stone-700 hover:bg-stone-100/50 transition cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                    <span>글로벌 에이전트 조건 및 지침 설정 (Custom Rule)</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isInstructionsExpanded ? "rotate-180" : ""}`} />
                </button>
                
                {isInstructionsExpanded && (
                  <div className="p-3.5 border-t border-stone-150 bg-white space-y-2.5">
                    <p className="text-[10px] text-stone-500 leading-normal font-semibold">
                      에이전트에게 **지켜야 할 특정 조건 이나 엄격한 마일스톤 규칙, 담당자 지연 상태 평가 방식** 등의 정형 규칙을 부여합니다. 코파일럿은 대화할 때마다 부여된 조건을 준수하여 응답합니다.
                    </p>
                    <textarea
                      value={customSystemInstructions}
                      onChange={(e) => handleSaveInstructions(e.target.value)}
                      placeholder="예: 마감이 4일 내로 임박했거나 오랜 시간 Hold된 샷들을 최우선적으로 탐지하고 일정 조정 조치사항을 시니어 PM 페르소나 형태로 엄격하게 가이드 피드백해 줘"
                      className="w-full h-24 bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800 focus:outline-none focus:border-indigo-400 focus:bg-white leading-relaxed font-sans shadow-3xs"
                    />
                    <div className="flex justify-between items-center text-[9px] text-stone-400 font-bold font-mono">
                      <span>✓ 타이핑 시 브라우저 로컬 저장소에 자동 기억됩니다</span>
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">로컬 동기화 완료</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ⚡ 지능형 퀵 추천 버튼 (타이핑 없이 바로 보고서 받기) */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest font-mono">신속한 원클릭 종합 분석</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendCopilotMessage("현재 프로젝트의 마감 병목 상태와 샷리스트 전체 공정 지연 리스크 요소를 종합적으로 진단하고 정리해줘.")}
                    disabled={isCopilotLoading}
                    className="flex flex-col items-start text-left p-3 rounded-2xl border border-rose-100 bg-rose-500/[0.04] hover:bg-rose-50 hover:border-rose-300 transition-all duration-200 text-[10px] font-black cursor-pointer disabled:opacity-50 h-full justify-between gap-1 shadow-3xs"
                  >
                    <span className="text-rose-700 font-extrabold flex items-center gap-1">🚨 리스크 진단</span>
                    <span className="text-stone-500 text-[8.5px] font-extrabold leading-tight">작업 중단 및 병목구간 리스크 탐색</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCopilotMessage("전체 샷의 담당자 스태프 배분 및 파이프라인 단계별 일정을 검토하고, 특정 담당자 몰림 현상이 있는지 분석한 후 이상적인 업무 조율 스케줄 가이드를 세워줘.")}
                    disabled={isCopilotLoading}
                    className="flex flex-col items-start text-left p-3 rounded-2xl border border-sky-100 bg-sky-500/[0.04] hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 text-[10px] font-black cursor-pointer disabled:opacity-50 h-full justify-between gap-1 shadow-3xs"
                  >
                    <span className="text-sky-700 font-extrabold flex items-center gap-1">📅 스케줄 배정</span>
                    <span className="text-stone-500 text-[8.5px] font-extrabold leading-tight">팀원 간 오버타임 업무 부하 로드 밸런싱</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCopilotMessage("현재 active 상태인 전체 샷리스트 데이터를 일목요연하게 정리하고 요약된 주간 추진 현황 보고서 다이어리로 한눈에 가독성 좋게 출력해줘.")}
                    disabled={isCopilotLoading}
                    className="flex flex-col items-start text-left p-3 rounded-2xl border border-emerald-100 bg-emerald-500/[0.04] hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 text-[10px] font-black cursor-pointer disabled:opacity-50 h-full justify-between gap-1 shadow-3xs"
                  >
                    <span className="text-emerald-850 font-extrabold flex items-center gap-1">📋 샷 전체 정리</span>
                    <span className="text-stone-500 text-[8.5px] font-extrabold leading-tight">진척도 가중치를 반영한 총 요약 보고서</span>
                  </button>
                </div>
              </div>

              {/* 💬 누적 대화 기록 */}
              <div className="border-t border-stone-150 pt-4 space-y-4">
                {copilotMessages.map((msg, index) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={index}
                      className={`flex flex-col max-w-[94%] ${isUser ? "ml-auto items-end animate-[slideInRight_0.2s_ease-out]" : "mr-auto items-start animate-[slideInLeft_0.2s_ease-out]"}`}
                    >
                      <div
                        className={`p-3.5 rounded-2xl text-[12.5px] leading-relaxed shadow-3xs font-sans ${
                          isUser
                            ? "bg-stone-905 bg-stone-900 text-stone-100 font-medium rounded-br-none"
                            : "bg-indigo-50/50 text-stone-850 border border-indigo-100/50 rounded-bl-none"
                        }`}
                      >
                        {/* Simple Markdown Renderer on messages */}
                        <div className="space-y-1.5 font-medium text-[12px] text-stone-750">
                          {msg.text.split("\n").map((line, lIdx) => {
                            if (line.startsWith("### ")) {
                              return (
                                <h4 key={lIdx} className="font-extrabold text-stone-900 text-[12.5px] mt-3.5 first:mt-0 font-sans tracking-tight border-b border-indigo-100/40 pb-1 flex items-center">
                                  <span>{line.substring(4)}</span>
                                </h4>
                              );
                            }
                            if (line.startsWith("**") && line.endsWith("**")) {
                              return (
                                <p key={lIdx} className="font-black text-stone-900 mt-2 text-[12px]">
                                  {line.replace(/\*\*/g, "")}
                                </p>
                              );
                            }
                            
                            // Highlight inline bold elements (**some**)
                            const regex = /\*\*(.*?)\*\*/g;
                            let match;
                            let lastIdx = 0;
                            const parts = [];
                            while ((match = regex.exec(line)) !== null) {
                              const preText = line.substring(lastIdx, match.index);
                              if (preText) parts.push({ text: preText, bold: false });
                              parts.push({ text: match[1], bold: true });
                              lastIdx = regex.lastIndex;
                            }
                            const postText = line.substring(lastIdx);
                            if (postText) parts.push({ text: postText, bold: false });

                            if (parts.length > 0) {
                              return (
                                <p key={lIdx} className="text-stone-700 min-h-[0.5rem] text-[12px]">
                                  {parts.map((p, pIdx) => (
                                    <span key={pIdx} className={p.bold ? "font-black text-indigo-700 bg-indigo-50/80 px-1 rounded" : ""}>
                                      {p.text}
                                    </span>
                                  ))}
                                </p>
                              );
                            }

                            if (line.startsWith("- ")) {
                              return (
                                <div key={lIdx} className="flex items-start text-stone-700 pl-1.5 text-[12px]">
                                  <span className="text-indigo-500 mr-2 shrink-0 select-none">•</span>
                                  <span>{line.substring(2)}</span>
                                </div>
                              );
                            }
                            
                            return (
                              <p key={lIdx} className="text-stone-700 min-h-[0.5rem] text-[12px]">
                                {line}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-stone-400 mt-1 uppercase tracking-widest font-mono">
                        {isUser ? "You" : "Gemini Co-Pilot"} • {msg.timestamp}
                      </span>
                    </div>
                  );
                })}

                {isCopilotLoading && (
                  <div className="flex flex-col items-start mr-auto max-w-[94%] animate-pulse">
                    <div className="bg-indigo-500/[0.04] border border-indigo-100/70 p-3.5 rounded-2xl rounded-bl-none text-[12px] text-indigo-800 font-extrabold flex items-center space-x-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>{project.name} 전체 샷리스트 ({shots.length}개) 및 설정 규격을 조율 중입니다...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. 드로워 하단 입력창 */}
            <div className="p-4 border-t border-stone-200 bg-stone-50/70 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCopilotMessage();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  disabled={isCopilotLoading}
                  placeholder="다양한 정리, 공정 일정 조율, 마일스톤 문제파악을 무한 질문하세요..."
                  className="flex-1 bg-white border border-stone-200 rounded-2xl text-xs px-4 py-3 font-semibold focus:outline-none focus:border-indigo-400 font-sans shadow-3xs"
                />
                <button
                  type="submit"
                  disabled={isCopilotLoading || !copilotInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl p-3 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
                  title="질문 전송"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex items-center justify-center gap-1 text-[8.5px] text-stone-400 font-semibold uppercase tracking-wider mt-2.5">
                <Database className="w-3 h-3 text-stone-400" />
                <span>에이전트 인셉션 스코프: Active VFX 샷 {shots.length}개 데이터 전량 수집</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
