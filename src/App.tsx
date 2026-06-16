import React, { useState, useEffect } from "react";
import ProjectList from "./components/ProjectList";
import ProjectDetail from "./components/ProjectDetail";
import TaskList from "./components/TaskList";
import TaskDetail from "./components/TaskDetail";
import VersionDetail from "./components/VersionDetail";
import Settings from "./components/Settings";
import { Film, Settings as SettingsIcon, Activity, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [view, setView] = useState<string>("projects");
  const [viewParams, setViewParams] = useState<any>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNavigate = (newView: string, params: any = {}) => {
    setView(newView);
    setViewParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRefreshAll = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Nav items description
  const navItems = [
    { id: "projects", label: "프로젝트", icon: Film },
    { id: "tasks", label: "태스크 피드", icon: Activity },
    { id: "settings", label: "설정", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-stone-800 flex flex-col font-sans select-none antialiased">
      {/* Dynamic App Navigation Header */}
      <header className="bg-white border-b border-stone-250/60 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button 
            onClick={() => handleNavigate("projects")}
            className="flex items-center space-x-2 text-stone-900 cursor-pointer active:scale-95 transition"
          >
            <Film className="w-5 h-5 text-blue-600 animate-pulse" />
            <span className="font-extrabold text-stone-900 text-sm tracking-widest uppercase">SG MOBILE</span>
          </button>

          {/* Global tab routing headers for phone layouts */}
          <nav className="flex items-center space-x-4">
            {navItems.map((item) => {
              const isCurrentlyActive = 
                view === item.id || 
                (item.id === "projects" && view === "project_detail") ||
                (item.id === "tasks" && view === "task_detail") ||
                (item.id === "projects" && view === "version_detail");

              const IconComp = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`text-[11px] font-black uppercase tracking-wider transition-colors duration-155 cursor-pointer flex items-center space-x-1 py-1 px-2 rounded-lg ${
                    isCurrentlyActive 
                      ? "text-blue-600 bg-blue-50 border border-blue-100" 
                      : "text-stone-500 hover:text-stone-850"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 inline" />
                  <span className="hidden xs:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${JSON.stringify(viewParams)}-${refreshTrigger}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full h-full"
          >
            {view === "projects" && (
              <ProjectList onNavigate={handleNavigate} />
            )}
            {view === "project_detail" && (
              <ProjectDetail projectId={viewParams.projectId} onNavigate={handleNavigate} />
            )}
            {view === "tasks" && (
              <TaskList initialUserId={viewParams.user_id} onNavigate={handleNavigate} />
            )}
            {view === "task_detail" && (
              <TaskDetail taskId={viewParams.taskId} onNavigate={handleNavigate} />
            )}
            {view === "version_detail" && (
              <VersionDetail versionId={viewParams.versionId} onNavigate={handleNavigate} />
            )}
            {view === "settings" && (
              <Settings onRefresh={handleRefreshAll} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
