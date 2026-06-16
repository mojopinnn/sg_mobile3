import React, { useEffect, useState } from "react";
import { Lock, Unlock, Key, FlaskConical, ShieldAlert, CheckCircle2, AlertCircle, Save, Loader2 } from "lucide-react";

interface SettingsProps {
  onRefresh: () => void;
}

export default function Settings({ onRefresh }: SettingsProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [config, setConfig] = useState({
    base_url: "",
    script_name: "",
    script_key: "",
    use_mock: true,
  });

  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Check local storage authenticated state
    const isAuth = localStorage.getItem("settings_authenticated") === "true";
    if (isAuth) {
      setAuthenticated(true);
      fetchConfig();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchConfig = () => {
    setLoading(true);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading settings:", err);
        setLoading(false);
      });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/settings/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem("settings_authenticated", "true");
          setAuthenticated(true);
          fetchConfig();
          setStatusMessage({ type: "success", text: "설정 페이지 인증에 성공했습니다." });
        } else {
          setStatusMessage({ type: "error", text: "비밀번호가 올바르지 않습니다." });
        }
      })
      .catch((err) => {
        console.error("Login error:", err);
        setStatusMessage({ type: "error", text: "로그인 처리 중 오류 발생" });
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("settings_authenticated");
    setAuthenticated(false);
    setStatusMessage({ type: "success", text: "설정 페이지가 안전하게 잠금 처리되었습니다." });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/settings/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatusMessage({ type: "success", text: "설정이 정상적으로 저장되고 반영되었습니다." });
          onRefresh(); // Refresh total stats
        } else {
          setStatusMessage({ type: "error", text: data.error || "설정 저장에 실패했습니다." });
        }
      })
      .catch((err) => {
        console.error("Error saving settings:", err);
        setStatusMessage({ type: "error", text: "서버 통신 실패" });
      });
  };

  const handleToggleMock = () => {
    fetch("/api/settings/toggle_mock", {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setConfig((prev) => ({ ...prev, use_mock: data.use_mock }));
          setStatusMessage({
            type: "success",
            text: data.use_mock ? "데모(Mock) 모드로 변경되었습니다." : "실제 Shotgrid API 연동 모드로 변경되었습니다."
          });
          onRefresh();
        } else {
          setStatusMessage({
            type: "error",
            text: data.error || "연동 모드 전환에 실패했습니다."
          });
        }
      })
      .catch((err) => {
        console.error("Error toggling mock mode:", err);
        setStatusMessage({ type: "error", text: "서버 통신 실패" });
      });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/settings/change_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_password: newPassword,
        current_password: currentPasswordInput
      })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => { throw new Error(d.error || "Failed") });
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setStatusMessage({ type: "success", text: "보안 관리자 비밀번호가 정상적으로 변경되었습니다." });
          setNewPassword("");
          setCurrentPasswordInput("");
        }
      })
      .catch((err: any) => {
        console.error("Error changing password:", err);
        setStatusMessage({ type: "error", text: err.message || "보안 변경 실패" });
      });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-stone-500 font-bold text-xs tracking-wider uppercase">보안 상태 확인 중...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 text-rose-600 mb-3 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-stone-950 tracking-tight">설정 페이지 잠금 해제</h1>
            <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
              설정 페이지는 관리자 전용 영역입니다.<br />
              액세스 비밀번호를 입력해 주십시오. (기본값: <span className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-700">1234</span>)
            </p>
          </div>

          {statusMessage && (
            <div className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center ${
              statusMessage.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
            }`}>
              {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <AlertCircle className="w-4 h-4 mr-1.5" />}
              {statusMessage.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1.5 tracking-wider">비밀번호 (PASSWORD)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
                  <Key className="w-4 h-4 text-stone-400" />
                </span>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-3 py-3 text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono tracking-widest"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              잠금 해제 및 진입
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <p className="text-[10px] text-stone-450 font-extrabold uppercase tracking-widest">Infrastructure & Connection</p>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-0.5">연동 제어 설정</h1>
        </div>
        <button
          onClick={handleLogout}
          className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-all flex items-center border border-stone-200 shadow-sm cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> 설정 잠금 (로그아웃)
        </button>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center shadow-sm ${
          statusMessage.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <AlertCircle className="w-4 h-4 mr-1.5" />}
          {statusMessage.text}
        </div>
      )}

      {/* Mode Quick Toggle Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-xs font-black text-stone-900 mb-2 flex items-center uppercase tracking-wider">
          <FlaskConical className="w-4 h-4 text-indigo-500 mr-2" /> 연동 모드 전환 컨트롤
        </h2>
        <p className="text-xs text-stone-500 mb-4 leading-relaxed">
          실제 Shotgrid 서버 자격 증명이 없는 상태에서도 100% 동작을 체감해 보실 수 있도록 인터랙티브 데모 모드가 마련되어 있습니다.
          상태 변동, 피드백 등은 내부 가상 DB에 정상 영속화됩니다.
        </p>

        <div className="bg-stone-50 border border-stone-150 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-stone-800 block">현재 서버 가동 모드</span>
            <span className="text-[10px] text-stone-400 font-bold mt-0.5 tracking-wide">클릭하여 실시간 데이터 전환</span>
          </div>

          <button
            onClick={handleToggleMock}
            className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wider transition uppercase shadow-sm cursor-pointer ${
              config.use_mock 
                ? "bg-amber-600 hover:bg-amber-500 text-white" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {config.use_mock ? "데모 모드 구동 중" : "실제 API 연동 모드"}
          </button>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-xs font-black text-stone-900 mb-4 flex items-center uppercase tracking-wider">
          <Key className="w-4 h-4 text-blue-500 mr-2" /> Shotgrid API 자격 증명 (Credentials)
        </h2>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">Shotgrid 사이트 URL</label>
            <input
              type="url"
              value={config.base_url}
              onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
              placeholder="https://your-studio.shotgrid.autodesk.com"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-850 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">API 스크립트 이름 (SCRIPT NAME)</label>
              <input
                type="text"
                value={config.script_name}
                onChange={(e) => setConfig({ ...config, script_name: e.target.value })}
                placeholder="mobile_review_script"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-850 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">API 스크립트 키 (SCRIPT KEY)</label>
              <input
                type="password"
                value={config.script_key}
                onChange={(e) => setConfig({ ...config, script_key: e.target.value })}
                placeholder="••••••••••••••••••••••••••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-850 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center cursor-pointer shadow-sm shadow-blue-500/20"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" /> 설정 정보 및 연결 저장
            </button>
          </div>
        </form>
      </div>

      {/* Password Change form */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-xs font-black text-stone-900 mb-2 flex items-center uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-500 mr-2" /> 설정 영역 보안 비밀번호 변경
        </h2>
        <p className="text-xs text-stone-500 mb-4 leading-relaxed">
          인가되지 않은 접근을 제어하기 위해 인프라 관리자 암호를 변경할 수 있습니다.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">현재 비밀번호 (CURRENT)</label>
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="현재 키 입력"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-850 focus:outline-none focus:ring-1 focus:ring-rose-550"
                required
              />
            </div>
            <div>
              <label className="block text-[8px] font-black text-stone-500 uppercase tracking-widest mb-1.5">새 비밀번호 (NEW PASSWORD)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새로운 값 입력"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-850 focus:outline-none focus:ring-1 focus:ring-rose-550"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-sm"
            >
              비밀번호 변경 및 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
