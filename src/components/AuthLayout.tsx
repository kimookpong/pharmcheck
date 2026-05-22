import React, { useState, useEffect } from "react";
import { UserProfile, UserRole } from "../types";
import { LogIn, Sparkles, ShieldAlert, CheckCircle } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface AuthLayoutProps {
  onLogin: (user: UserProfile) => void;
  googleUser?: any;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ onLogin, googleUser }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [customName, setCustomName] = useState<string>("");
  const [customStudentId, setCustomStudentId] = useState<string>("");
  const [customEmail, setCustomEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>("");

  useEffect(() => {
    // Fetch CSRF token for Auth.js POST requests
    fetch("/api/auth/csrf")
      .then(res => res.json())
      .then(data => {
        if (data && data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      })
      .catch(err => console.error("Failed to fetch CSRF token", err));
      
    if (googleUser) {
      setCustomName(googleUser.name || "");
      setCustomEmail(googleUser.email || "");
    }
  }, [googleUser]);

  const handleGoogleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!googleUser) return;
    if (!customName.trim() || !customEmail.trim()) return;
    if (selectedRole === "student" && !customStudentId.trim()) return;

    const googleProfile: UserProfile = {
      uid: googleUser?.id || googleUser?.email || "user_" + Math.random().toString(36).substring(2, 11),
      name: customName,
      email: customEmail,
      role: selectedRole,
      photoURL: googleUser.photoURL || undefined,
      ...(selectedRole === "student" && { studentId: customStudentId })
    };

    onLogin(googleProfile);
  };

  if (googleUser) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#12b19d] text-white px-6 py-6 text-center relative border-b border-teal-600/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8 blur-2xl pointer-events-none" />
            <Sparkles className="w-10 h-10 text-emerald-300 mx-auto mb-2 animate-pulse" />
            <h2 className="text-base font-bold">ยืนยันและระบุบทบาทสำหรับพิกัด</h2>
            <p className="text-[11px] text-teal-105 mt-1">
              ผู้ใช้กูเกิล: {googleUser.email}
            </p>
          </div>

          <form onSubmit={handleGoogleSetupSubmit} className="p-6 space-y-4 font-sans">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-[11px] font-semibold flex items-start gap-2 animate-fade-in shadow-sm">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-normal">{errorMsg}</span>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">เลือกสิทธิ์การเข้าใช้งาน</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedRole("student")}
                  className={`py-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                    selectedRole === "student" ? "bg-white text-[#12b19d] shadow-sm" : "text-slate-550 hover:text-slate-800"
                  }`}
                >
                  นักศึกษา (Student)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("teacher")}
                  className={`py-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                    selectedRole === "teacher" ? "bg-white text-[#12b19d] shadow-sm" : "text-slate-550 hover:text-slate-800"
                  }`}
                >
                  อาจารย์ (Teacher)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">ชื่อ-นามสกุลจริง</label>
                <input
                  type="text"
                  placeholder="กรอกชื่อจริงของท่านเพื่อใช้ในรายงาน"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#12b19d] focus:outline-none"
                  required
                />
              </div>

              {selectedRole === "student" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">รหัสนักศึกษา</label>
                  <input
                    type="text"
                    placeholder="กรอกรหัส 8 หลัก เช่น 64020993"
                    value={customStudentId}
                    onChange={(e) => setCustomStudentId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#12b19d] focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">อีเมลติดต่อ (Google)</label>
                <input
                  type="email"
                  disabled
                  value={customEmail}
                  className="w-full text-xs border border-slate-100 bg-slate-50 text-slate-450 rounded-xl px-3.5 py-2.5 cursor-not-allowed focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#12b19d] hover:bg-[#0fa18e] text-white rounded-xl py-3 mt-2 flex items-center justify-center gap-2 font-bold text-xs shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-emerald-100" />
              <span>เข้าเช็คชื่อระบบฐานข้อมูล (Live Cloud Sync)</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/signout";
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2 flex items-center justify-center gap-2 text-xs transition cursor-pointer"
            >
              ยกเลิก
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
        
        {/* Banner header mimicking the user image */}
        <div className="bg-gradient-to-br from-[#ebfcf9] via-white to-[#e0f7f3] text-slate-900 px-6 py-8 text-center relative overflow-hidden border-b border-slate-100 flex flex-col items-center">
          {/* Soft background light blooms like the image */}
          <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#0ea5e9]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-[#12b19d]/15 rounded-full blur-3xl pointer-events-none" />
          
          {/* PharmCheck brand logo centered */}
          <BrandLogo size="md" className="mb-6 z-10" />

          {/* Slogan with large, high-fidelity check mark and clean green design */}
          <div className="space-y-2.5 mt-2 max-w-[320px] mx-auto z-10">
            <div className="inline-flex items-center gap-2 bg-[#12b19d]/10 text-[#0f8a7a] px-3.5 py-1.5 rounded-2xl border border-[#12b19d]/20 shadow-sm animate-pulse">
              <CheckCircle className="w-4 h-4 text-[#12b19d] fill-white" />
              <span className="text-[11px] font-bold tracking-tight">Digital Attendance</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 leading-tight font-sans tracking-tight">
              with <span className="text-[#12b19d]">Mobile/GPS</span>
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-[11.5px] font-semibold flex items-start gap-2.5 animate-fade-in shadow-sm">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Live Google Auth Sync */}
          <div className="space-y-3 pb-4 font-sans">
            <form action="/api/auth/signin/google" method="POST">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <button
                type="submit"
                className="w-full bg-[#12b19d] hover:bg-[#0fa18e] text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2.5 shadow-md font-bold text-xs transition transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0 animate-pulse" />
                <span>ลงชื่อเข้าใช้งานด้วย Google Account</span>
              </button>
            </form>
          </div>

          {/* Location security info note */}
          <div className="text-[10px] text-slate-450 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-450 shrink-0 mt-0.5" />
            <span>
              <b>การยืนยันตำแหน่ง:</b> ระบบจะบันทึกพิกัด GPS ณ วันและเวลาที่กดเช็คชื่อ เพื่อตรวจสอบความตรงจุด และรับรองการเข้าห้องเรียนของท่านในรัศมีไม่เกิน 10 เมตร
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
