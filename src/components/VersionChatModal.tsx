import React, { useState, useEffect } from "react";
import { Brain, X, PlayCircle, Loader2, Send } from "lucide-react";
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
  const [versionAnalysisMode, setVersionAnalysisMode] = useState<
    "general" | "clipping" | "tracking" | "lighting"
  >("general");

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
        }),
      });

      if (!res.ok) throw new Error("분석 서버와 원활하게 연결되지 않았습니다.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-stone-200 rounded-3xl p-5 md:p-6 shadow-2xl relative w-full max-w-2xl flex flex-col h-[640px] max-h-[90vh]">
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
                  gemini-3.5-flash
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-bold mt-1">
                버전: {version.code} • 샷 디폴트 프리뷰
              </p>
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

        {/* Quick Informative Panel & Mini Video Preview Row */}
        <div className="bg-stone-50 border border-stone-150 rounded-2xl p-3 mb-4 shrink-0 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">
              SELECTED PLAYBACK PLAYER
            </span>
            <span className="text-xs font-black text-stone-800 block truncate">{version.code}</span>
            <span className="text-[9px] text-stone-500 block truncate mt-0.5 max-w-sm">
              URL: {getVersionVideoUrl(version)}
            </span>
          </div>
          <div
            onClick={() => handlePlayVersionVideo(version)}
            className="w-24 h-14 bg-black rounded-xl border border-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow group cursor-pointer hover:border-blue-400 transition"
            title="미디어 플레이어로 시점 전환"
          >
            {version.image ? (
              <>
                <img
                  src={version.image}
                  alt={version.code}
                  className="object-cover w-full h-full group-hover:scale-105 transition"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 flex items-center justify-center transition">
                  <PlayCircle className="w-5 h-5 text-white/90 drop-shadow-md" />
                </div>
              </>
            ) : (
              <PlayCircle className="w-5 h-5 text-indigo-400" />
            )}
          </div>
        </div>

        {/* Analysis Mode Category Selection Chips */}
        <div className="mb-4 shrink-0">
          <label className="block text-[9.5px] font-black text-stone-400 uppercase tracking-wider mb-2">
            분석 정합 초점 변경 (SET AI DIAGNOSIS MODE)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { mode: "general" as const, label: "종합 비주얼 코칭", desc: "전체 렌더 밸런스 검수" },
              { mode: "clipping" as const, label: "화이트 클리핑 진단", desc: "폭발/이펙트 노출 체크" },
              { mode: "tracking" as const, label: "카메라 트래킹 연동", desc: "3D 솔브 일치 오차 분석" },
              { mode: "lighting" as const, label: "야간 조명 최적화", desc: "암부 노출 소실 검토" },
            ].map((item) => {
              const isActive = versionAnalysisMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => {
                    setVersionAnalysisMode(item.mode);
                    // Apply quick automatic assistant template
                    let promptText = "";
                    if (item.mode === "clipping") {
                      promptText =
                        "이 버전 영상의 불꽃 및 광량 폭발 구간에 화이트 클리핑이 생기어 텍스처 디테일이 뭉개지거나 날라가는지 전용 진단을 돌려서 노펙 커브 수정안을 제안해주세요.";
                    } else if (item.mode === "tracking") {
                      promptText =
                        "매치무브와 카메라 핸드헬드 플레이트 상에서 모션 포인트 밀림(Tracking slip)이 있는지 분석해 타격 시 쉐이크 보강 솔루션을 조언해 주십시오.";
                    } else if (item.mode === "lighting") {
                      promptText =
                        "야간 전투 배경 씬의 조도 대치 상황에서 아티스트 감마 블랙 레벨이 완전히 뭉개져 묻히지 않도록 최적 가중 조명 제어를 제시해주세요.";
                    } else {
                      promptText =
                        "이 버전 영상의 콤프 슛 경계면 완만화 에지 마크 랩(light wrap)과 종합 비주얼 합성 품질에 완성도를 체크리스트 요약과 함께 종합 조언 바랍니다.";
                    }
                    setCurrentVersionMessage(promptText);
                  }}
                  className={`text-left px-3 py-2 rounded-xl border transition cursor-pointer flex-1 min-w-[120px] ${
                    isActive
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase leading-tight">{item.label}</p>
                  <span
                    className={`text-[8px] font-medium leading-none block whitespace-nowrap overflow-hidden text-ellipsis ${
                      isActive ? "text-indigo-100" : "text-stone-400"
                    }`}
                  >
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto bg-stone-50 border border-stone-150 rounded-2xl p-4 mb-4 space-y-3 flex flex-col-reverse">
          <div className="space-y-3 flex flex-col justify-end min-h-full">
            {versionChatMessages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${
                    isUser ? "ml-auto items-end" : "mr-auto items-start animate-fade-in"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-[11px] leading-relaxed select-text shadow-sm ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-white border border-stone-200 text-stone-800 rounded-bl-none"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap font-sans font-bold">{msg.text}</p>
                    ) : (
                      <div className="whitespace-pre-wrap font-sans space-y-1 prose prose-stone max-w-none">
                        {/* Simple inline robust markdown headers rendering */}
                        {msg.text.split("\n").map((line, lIdx) => {
                          if (line.startsWith("### ")) {
                            return (
                              <h4
                                key={lIdx}
                                className="text-stone-950 font-black text-xs pt-1.5 pb-0.5 border-b border-indigo-100"
                              >
                                {line.replace("### ", "")}
                              </h4>
                            );
                          }
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                              <p key={lIdx} className="text-stone-900 font-extrabold">
                                {line.replace(/\*\*/g, "")}
                              </p>
                            );
                          }
                          if (line.startsWith("- ")) {
                            return (
                              <div key={lIdx} className="flex items-start text-stone-850 pl-1.5">
                                <span className="text-indigo-500 mr-1.5 shrink-0">•</span>
                                <span>{line.replace("- ", "")}</span>
                              </div>
                            );
                          }
                          return (
                            <p key={lIdx} className="text-stone-700 min-h-[0.5rem] leading-normal">
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-bold text-stone-400 mt-1 uppercase tracking-widest font-mono">
                    {isUser ? "You" : "Gemini AI"} • {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {isVersionChatLoading && (
              <div className="flex flex-col items-start mr-auto max-w-[85%] animate-pulse">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl rounded-bl-none text-[11px] text-indigo-800 font-bold flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>제미나이 비전 엔진이 비디오의 공정 정보를 지능 프레임 대조 점검 중입니다...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <div className="shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendVersionChatMessage();
            }}
            className="flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                disabled={isVersionChatLoading}
                placeholder="해당 영상에 대해 피드백할 수정을 제미나이에게 물어보세요... (프레임 단위 점검)"
                value={currentVersionMessage}
                onChange={(e) => setCurrentVersionMessage(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-2xl pl-4 pr-12 py-3.5 text-xs text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={isVersionChatLoading || !currentVersionMessage.trim()}
                className="absolute right-2.5 top-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-200 text-white disabled:text-stone-400 rounded-xl p-2 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
