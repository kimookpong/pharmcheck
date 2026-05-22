import React, { useState, useEffect } from "react";
import { UserProfile } from "./types";
import { LocationProvider } from "./components/LocationContext";
import { AuthLayout } from "./components/AuthLayout";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentView } from "./components/StudentView";

import { 
  GraduationCap, 
  Sparkles, 
  RefreshCw, 
  Layers,
  User,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Lock,
  Compass,
  Database, 
  MapPin, 
  Download, 
  X
} from "lucide-react";
import { BrandLogo } from "./components/BrandLogo";
import { motion, AnimatePresence } from "motion/react";
import { authClient, neonClient } from "./lib/neon";

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>("");
  const [editStudentId, setEditStudentId] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Resume user profile session on load from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("attendance_system_current_user");
    if (cached) {
      try {
        const profile = JSON.parse(cached) as UserProfile;
        setCurrentUser(profile);
      } catch (e) {
        console.warn("Cached session parse error:", e);
      }
    }
    setIsReady(true);
  }, []);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    }
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem("attendance_system_current_user", JSON.stringify(user));
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Sign out error", err);
    }
    localStorage.removeItem("attendance_system_current_user");
    setCurrentUser(null);
    setIsMenuOpen(false);
  };

  const handleResetAccount = async () => {
    if (!currentUser) return;
    
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสิทธิ์การเข้าใช้งาน? คุณจะต้องเลือกว่าเป็นอาจารย์หรือนักศึกษาใหม่ในการเข้าสู่ระบบครั้งถัดไป")) {
      try {
        await neonClient.from('user_profiles').delete().eq('uid', currentUser.uid);
      } catch (err) {
        console.error("Failed to delete user profile", err);
      }
      handleLogout();
    }
  };



  // Remove safe wrapper as Firebase is removed
  const getDbRef = () => {
    return null;
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#12b19d] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">กำลังเตรียมความพร้อมของระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <LocationProvider>
      <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900 transition-colors duration-200">
        
        {/* Main top structural application bar */}
        <header className="border-b border-slate-200/65 bg-white/95 backdrop-blur shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            <BrandLogo size="sm" />

            {currentUser && (
              <div className="relative">
                {/* Backdrop overlay for dropdown close click */}
                {isMenuOpen && (
                  <div 
                    className="fixed inset-0 z-30 cursor-default" 
                    onClick={() => setIsMenuOpen(false)}
                  />
                )}

                <div className="flex items-center gap-3">
                  <span className="text-[9px] bg-teal-50 text-[#12b19d] border border-teal-200/50 font-mono font-black px-2 py-0.5 rounded-md uppercase hidden md:flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#12b19d] rounded-full animate-ping" />
                    NEON ACTIVE
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-slate-50 border border-slate-200/80 bg-slate-50/50 transition duration-200 select-none cursor-pointer focus:outline-hidden relative z-40 active:scale-98"
                    id="avatar-menu-button"
                  >
                    {currentUser.photoURL ? (
                      <div className="relative shrink-0">
                        <img 
                          src={currentUser.photoURL} 
                          alt={currentUser.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl object-cover shadow-xs border border-slate-200/80 bg-slate-100"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center text-white relative shadow-sm shrink-0 uppercase bg-gradient-to-tr ${
                        currentUser.role === "teacher" 
                          ? "from-[#12b19d] to-teal-400" 
                          : "from-emerald-500 to-teal-400"
                      }`}>
                        {currentUser.name.substring(0, 1).toUpperCase()}
                        <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </div>
                    )}
                    
                    <div className="hidden sm:flex flex-col text-left max-w-[124px]">
                      <span className="text-xs font-bold text-slate-800 truncate leading-none mb-0.5">
                        {currentUser.name.split(" ")[0]}
                      </span>
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                        {currentUser.role === "teacher" ? "อาจารย์" : "นักศึกษา"}
                      </span>
                    </div>

                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-2 w-76 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-40 overflow-hidden text-left"
                      id="avatar-dropdown-menu"
                    >
                      {/* Profile details preview inside dropdown header */}
                      <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-start gap-3">
                        {currentUser.photoURL ? (
                          <img 
                            src={currentUser.photoURL} 
                            alt={currentUser.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover shadow-sm border border-slate-200 bg-slate-100 shrink-0"
                          />
                        ) : (
                          <div className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center text-white relative shadow-sm uppercase bg-gradient-to-tr shrink-0 ${
                            currentUser.role === "teacher" 
                              ? "from-[#12b19d] to-teal-400" 
                              : "from-emerald-500 to-teal-400"
                          }`}>
                            {currentUser.name.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-1 overflow-hidden">
                          <h4 className="font-extrabold text-slate-800 text-xs truncate leading-tight">{currentUser.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentUser.email}</p>
                          
                          {currentUser.studentId && (
                            <p className="text-[10px] text-[#12b19d] font-mono font-bold">
                              รหัส: {currentUser.studentId}
                            </p>
                          )}

                          <div className="pt-0.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8.5px] font-bold tracking-wide uppercase border ${
                              currentUser.role === "teacher"
                                ? "bg-brand-50 text-[#12b19d] border-brand-100"
                                : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            }`}>
                              {currentUser.role === "teacher" ? "อาจารย์ผู้สอน" : "นักศึกษา"}
                            </span>
                          </div>
                        </div>
                      </div>



                      {/* Menu navigation options */}
                      <div className="p-2 space-y-0.5">

                        {/* Edit Profile Action (Student only) */}
                        {currentUser.role === "student" && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              setEditName(currentUser.name);
                              setEditStudentId(currentUser.studentId || "");
                              setIsEditingProfile(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-teal-600 hover:bg-teal-50/70 rounded-xl flex items-center gap-2.5 transition cursor-pointer mb-1"
                          >
                            <User className="w-4 h-4 text-teal-500" />
                            <span>แก้ไขชื่อและรหัสนักศึกษา</span>
                          </button>
                        )}

                        {/* PWA Install Action */}
                        {deferredPrompt && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              handleInstallApp();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50/70 rounded-xl flex items-center gap-2.5 transition cursor-pointer mb-1"
                          >
                            <Download className="w-4 h-4 text-indigo-500" />
                            <span>ติดตั้งแอปพลิเคชันลงในเครื่อง</span>
                          </button>
                        )}

                        {/* Reset Account Action */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleResetAccount();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50/70 rounded-xl flex items-center gap-2.5 transition cursor-pointer mb-1"
                        >
                          <RefreshCw className="w-4 h-4 text-amber-500" />
                          <span>ลบข้อมูลและเริ่มใหม่ (Reset Account)</span>
                        </button>

                        {/* Logout menu action */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50/70 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          <span>ออกจากระบบ</span>
                        </button>
                      </div>

                      {/* Version identifier in dropdown footer */}
                      <div className="px-4 py-2 bg-slate-50/90 border-t border-slate-100 text-center select-none">
                        <span className="text-[8px] font-mono text-slate-400 font-bold tracking-wide">
                          PharmCheck v1.2.5 • NeonDB Pooler
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        {/* Core Screen Routing */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 min-h-[75vh]">
          {!currentUser ? (
            <AuthLayout onLogin={handleLogin} />
          ) : currentUser.role === "teacher" ? (
            <TeacherDashboard teacher={currentUser} onLogout={handleLogout} dbRef={getDbRef()} />
          ) : (
            <StudentView student={currentUser} onLogout={handleLogout} dbRef={getDbRef()} />
          )}

          {/* Edit Profile Modal */}
          {isEditingProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-lg">แก้ไขข้อมูลส่วนตัว</h3>
                  <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-slate-600 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">ชื่อ-นามสกุล</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:border-[#12b19d] focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">รหัสนักศึกษา</label>
                    <input
                      type="text"
                      value={editStudentId}
                      onChange={(e) => setEditStudentId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:border-[#12b19d] focus:outline-none transition font-mono"
                    />
                  </div>
                  
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        if (!editName.trim() || !editStudentId.trim()) return;
                        setIsSavingProfile(true);
                        try {
                          const { error } = await neonClient.from('user_profiles')
                            .update({ name: editName.trim(), student_id: editStudentId.trim() })
                            .eq('uid', currentUser.uid);
                          
                          if (error) throw new Error(error.message);
                          
                          const updatedUser = { ...currentUser, name: editName.trim(), studentId: editStudentId.trim() };
                          setCurrentUser(updatedUser);
                          localStorage.setItem("attendance_system_current_user", JSON.stringify(updatedUser));
                          setIsEditingProfile(false);
                        } catch (err) {
                          console.error("Failed to update profile:", err);
                          alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
                        } finally {
                          setIsSavingProfile(false);
                        }
                      }}
                      disabled={isSavingProfile || !editName.trim() || !editStudentId.trim()}
                      className="w-full bg-[#12b19d] hover:bg-[#0fa18e] disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 transition"
                    >
                      {isSavingProfile ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </main>
      </div>
    </LocationProvider>
  );
}
