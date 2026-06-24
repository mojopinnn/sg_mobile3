import React, { useState, useEffect } from "react";
import { Brain, X, PlayCircle, Loader2, Send, Eye, EyeOff, Info, ClipboardList, MessageSquareMore, Film, FileText, Plus } from "lucide-react";
import { Version, Shot } from "../types";

interface VersionChatModalProps {
  version: Version;
  onClose: () => void;
  getVersionVideoUrl: (v: any) => string;
  handlePlayVersionVideo: (v: any) => void;
  shots: Shot[];
}

export const VersionChatModal: React.FC<VersionChatModalProps> = ({
  version,
  onClose,
  getVersionVideoUrl,
  handlePlayVersionVideo,
  shots,
}) => {
  const [versionChatMessages, setVersionChatMessages] = useState<
    Array<{ sender: "user" | "gemini"; text: string; timestamp: string }>
  >([]);
  const [currentVersionMessage, setCurrentVersionMessage] = useState<string>("");
  const [isVersionChatLoading, setIsVersionChatLoading] = useState<boolean>(false);
  
  // 4 Core selective Gemini analysis configuration states (highly flexible toggles)
  const [includeShotDescription, setIncludeShotDescription] = useState<boolean>(true);
  const [includeWorkOrder, setIncludeWorkOrder] = useState<boolean>(true);
  const [includeVersionDescription, setIncludeVersionDescription] = useState<boolean>(true);
  const [enableVision, setEnableVision] = useState<boolean>(false);

  // Toggle state to collapse/expand optional configurations via + button like Gemini app
  const [showContextToggles, setShowContextToggles] = useState<boolean>(true);

  const [versionAnalysisMode, setVersionAnalysisMode] = useState<
    "general" | "clipping" | "tracking" | "lighting"
  >("general");
  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({});

  // Dynamically calculate style to adapt perfectly to mobile visual viewport (virtual keyboards)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (vv) {
        if (window.innerWidth < 640) {
          // On mobile, pin the modal's outer boundary to the exact visual viewport bounds
          setViewportStyle({
            position: "fixed",
            top: `${vv.offsetTop}px`,
            left: `${vv.offsetLeft}px`,
            width: `${vv.width}px`,
            height: `${vv.height}px`,
          });
        } else {
          setViewportStyle({});
        }
      } else {
        setViewportStyle({});
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }
    window.addEventListener("resize", handleResize);
    handleResize();

    const fallbackTimer = setTimeout(handleResize, 300);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
      window.removeEventListener("resize", handleResize);
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Welcome message on load
  useEffect(() => {
    if (version) {
      setVersionChatMessages([
        {
          sender: "gemini",
          text: `안녕하세요! 톰슨 VFX 연구소 제미나이 영상 공정 파트너입니다. \`${
            version.code
          }\` 버전에 수록된 주소 \`${getVersionVideoUrl(
            version
          )}\` 영상을 분석할 준비가 완료되었습니다. 완성도 검수를 원하는 부분을 아래 옵션 칩에서 선택하거나 직접 입력해 주세요!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [version, getVersionVideoUrl]);

  const handleSendVersionChatMessage = async () => {
    if (!currentVersionMessage.trim() || !version) return;

    const userMsg = currentVersionMessage;
    const matchedShot = shots.find(
      (s) =>
        (version.entity && version.entity.id === s.id) ||
        (version.entity && version.entity.name === s.code)
    );
    const shotCode = matchedShot ? matchedShot.code : "Unknown Shot";
    const videoUrl = getVersionVideoUrl(version);

    // Append user message immediately
    const userBubble = {
      sender: "user" as const,
      text: userMsg,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setVersionChatMessages((prev) => [...prev, userBubble]);
    setCurrentVersionMessage("");
    setIsVersionChatLoading(true);

    try {
      // Gather chat history formatted for backend
      const formattedHistory = versionChatMessages.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("model" as const),
        text: m.text,
      }));

      const res = await fetch("/api/intelligence/analyze-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionCode: version.code,
          shotCode: shotCode,
          videoUrl: videoUrl,
          userMessage: userMsg,
          chatHistory: formattedHistory,
          analysisMode: versionAnalysisMode,
          shotDescription: includeShotDescription ? (matchedShot?.description || "") : "",
          shotWorkOrder: includeWorkOrder ? (matchedShot?.sg_work_order || "") : "",
          versionDescription: includeVersionDescription ? (version.description || "") : "",
          enableVision: enableVision,
        }),
      });

      if (!res.ok) {
        let errMsg = "분석 서버와 원활하게 연결되지 않았습니다.";
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          } else if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();

      const geminiBubble = {
        sender: "gemini" as const,
        text: data.responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setVersionChatMessages((prev) => [...prev, geminiBubble]);
    } catch (e: any) {
      const errorBubble = {
        sender: "gemini" as const,
        text: `❌ 에러: ${e.message || "영상 분석을 수행할 수 없습니다."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setVersionChatMessages((prev) => [...prev, errorBubble]);
    } finally {
      setIsVersionChatLoading(false);
    }
  };

  return (
    <div 
      style={viewportStyle}
      className="fixed inset-0 z-50 flex sm:items-center justify-center sm:p-2 md:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="bg-white border-0 sm:border border-stone-200 rounded-none sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative w-full sm:max-w-[98vw] lg:max-w-[96vw] xl:max-w-[96vw] flex flex-col h-full sm:h-[93vh] sm:max-h-[1000px] max-h-full"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-stone-150 pb-4 mb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-2xl">
              <Brain className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-stone-900 leading-none">제미나이 AI 영상 분석 공정</h3>
                <span className="bg-indigo-100 text-indigo-800 text-[8px] font-black uppercase px-2 py-0.5 rounded-md font-mono tracking-wider">
                  gemini-2.5-flash
                </span>
              </div>
              <div className="text-[10px] text-stone-400 font-bold mt-1 flex items-center gap-1.5 flex-wrap">
                <span>버전: {version.code}</span>
                <span className="text-stone-300">•</span>
                <button
                  type="button"
                  onClick={() => handlePlayVersionVideo(version)}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  title="미디어 플레이어로 시점 전환"
                >
                  <PlayCircle className="w-3.5 h-3.5 inline" />
                  <span>미디어 플레이어 재생</span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-full p-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto bg-stone-50 border border-stone-150 rounded-2xl p-4 mb-4 space-y-3 flex flex-col-reverse">
          <div className="space-y-3 flex flex-col justify-end min-h-full">
            {versionChatMessages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[96%] ${
                    isUser ? "ml-auto items-end" : "mr-auto items-start animate-fade-in"
                  }`}
                >
                  <div
                    className={`p-4 rounded-2xl text-[18px] leading-relaxed select-text shadow-sm ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-white border border-stone-200 text-stone-800 rounded-bl-none"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap font-sans font-bold">{msg.text}</p>
                    ) : (
                      <div className="whitespace-pre-wrap font-sans space-y-1.5 prose prose-stone max-w-none">
                        {/* Simple inline robust markdown headers rendering */}
                        {msg.text.split("\n").map((line, lIdx) => {
                          if (line.startsWith("### ")) {
                            return (
                              <h4
                                key={lIdx}
                                className="text-stone-950 font-black text-[20px] pt-2.5 pb-1 border-b-2 border-indigo-100"
                              >
                                {line.replace("### ", "")}
                              </h4>
                            );
                          }
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                              <p key={lIdx} className="text-stone-900 font-black text-[19px]">
                                {line.replace(/\*\*/g, "")}
                              </p>
                            );
                          }
                          if (line.startsWith("- ")) {
                            return (
                              <div key={lIdx} className="flex items-start text-stone-850 pl-1.5 text-[18px]">
                                <span className="text-indigo-500 mr-1.5 shrink-0">•</span>
                                <span>{line.replace("- ", "")}</span>
                              </div>
                            );
                          }
                          return (
                            <p key={lIdx} className="text-stone-700 min-h-[0.5rem] leading-normal text-[18px]">
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-stone-400 mt-1.5 uppercase tracking-widest font-mono">
                    {isUser ? "You" : "Gemini AI"} • {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {isVersionChatLoading && (
              <div className="flex flex-col items-start mr-auto max-w-[96%] animate-pulse">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl rounded-bl-none text-[16px] text-indigo-800 font-bold flex items-center space-x-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>제미나이 AI가 비디오 영상의 비주얼을 시각 분석 중입니다...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <div className="shrink-0">
          {/* Selective analysis context manager (4 multi-select togglers) */}
          {showContextToggles && (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 mb-3 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-2 border-b border-stone-150 gap-1.5">
                <div className="flex items-center space-x-1.5">
                  <Brain className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span className="text-[11px] font-black text-stone-800 uppercase tracking-wider">
                    제미나이 분석 컨텍스트 조건 설정 (Multi-Select)
                  </span>
                </div>
                <span className="text-[9.5px] text-stone-400 font-bold">
                  비교 대조할 데이터를 선택적으로 온/오프할 수 있습니다.
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Option 1: Description */}
                <button
                  type="button"
                  onClick={() => setIncludeShotDescription(prev => !prev)}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border transition cursor-pointer select-none text-left ${
                    includeShotDescription
                      ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-3xs"
                      : "bg-white border-stone-200 text-stone-450 hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${includeShotDescription ? "bg-indigo-100/70" : "bg-stone-100"}`}>
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${includeShotDescription ? "text-indigo-700" : "text-stone-400"}`} />
                  </div>
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] truncate">기획 설명</p>
                    <p className="text-[8.5px] font-bold text-stone-400 truncate mt-0.5">Description</p>
                  </div>
                </button>

                {/* Option 2: Work Order */}
                <button
                  type="button"
                  onClick={() => setIncludeWorkOrder(prev => !prev)}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border transition cursor-pointer select-none text-left ${
                    includeWorkOrder
                      ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-3xs"
                      : "bg-white border-stone-200 text-stone-450 hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${includeWorkOrder ? "bg-indigo-100/70" : "bg-stone-100"}`}>
                    <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${includeWorkOrder ? "text-indigo-700" : "text-stone-400"}`} />
                  </div>
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] truncate">작업 지시서</p>
                    <p className="text-[8.5px] font-bold text-stone-400 truncate mt-0.5">Work Order</p>
                  </div>
                </button>

                {/* Option 3: Artist Comment */}
                <button
                  type="button"
                  onClick={() => setIncludeVersionDescription(prev => !prev)}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border transition cursor-pointer select-none text-left ${
                    includeVersionDescription
                      ? "bg-indigo-50/50 border-indigo-400 text-indigo-900 shadow-3xs"
                      : "bg-white border-stone-200 text-stone-450 hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${includeVersionDescription ? "bg-indigo-100/70" : "bg-stone-100"}`}>
                    <MessageSquareMore className={`w-3.5 h-3.5 shrink-0 ${includeVersionDescription ? "text-indigo-700" : "text-stone-400"}`} />
                  </div>
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] truncate">아티스트 의견</p>
                    <p className="text-[8.5px] font-bold text-stone-400 truncate mt-0.5">Comment</p>
                  </div>
                </button>

                {/* Option 4: Vision */}
                <button
                  type="button"
                  onClick={() => setEnableVision(prev => !prev)}
                  className={`flex items-center space-x-2.5 p-2 rounded-xl border transition cursor-pointer select-none text-left ${
                    enableVision
                      ? "bg-rose-50 border-rose-400 text-rose-950 shadow-3xs animate-pulse"
                      : "bg-white border-stone-200 text-stone-450 hover:border-stone-300 hover:bg-stone-50/50"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${enableVision ? "bg-rose-100" : "bg-stone-100"}`}>
                    <Film className={`w-3.5 h-3.5 shrink-0 ${enableVision ? "text-rose-600 animate-spin" : "text-stone-400"}`} style={{ animationDuration: enableVision ? '6s' : '0s' }} />
                  </div>
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] truncate">비디오 검수</p>
                    <p className="text-[8.5px] font-bold text-stone-400 truncate mt-0.5">Gemini Vision</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendVersionChatMessage();
            }}
            className="flex items-center space-x-2 bg-white pb-1"
          >
            {/* Gemini-like Expandable Plus (+) Button */}
            <button
              type="button"
              onClick={() => setShowContextToggles(prev => !prev)}
              className={`p-3.5 rounded-2xl border transition duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                showContextToggles
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md active:bg-indigo-700"
                  : "bg-stone-100 hover:bg-stone-250 border-stone-200 text-stone-600 hover:text-stone-950 active:bg-stone-200"
              }`}
              title="제미나이 조건 설정 필터 켜기/끄기"
            >
              <Plus
                className="w-5.5 h-5.5 transition-transform duration-300"
                style={{ transform: showContextToggles ? "rotate(45deg)" : "rotate(0deg)" }}
              />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                disabled={isVersionChatLoading}
                placeholder="해당 영상에 대해 필요한 피드백이나 질문을 입력하세요..."
                value={currentVersionMessage}
                onChange={(e) => setCurrentVersionMessage(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-2xl pl-4 pr-14 py-4 text-[18px] text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={isVersionChatLoading || !currentVersionMessage.trim()}
                className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl p-2.5 transition cursor-pointer"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
