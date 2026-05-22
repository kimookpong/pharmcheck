import React, { useState, useEffect } from "react";
import { Session, Attendance, UserProfile } from "../types";
import { AttendanceService } from "../services/attendanceService";
import { useLocation } from "./LocationContext";
import { ClassroomRadar } from "./ClassroomRadar";
import { ClassroomSelectorMap } from "./ClassroomSelectorMap";
import { ManualLocationSimulator } from "./ManualLocationSimulator";
import { AttendanceMap } from "./AttendanceMap";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Play, 
  Square, 
  MapPin, 
  Compass, 
  Clock, 
  Download, 
  Calendar, 
  Users, 
  LogOut, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  GraduationCap, 
  Timer, 
  CheckCircle2, 
  SlidersHorizontal,
  PieChart,
  TrendingUp,
  X,
  User,
  HelpCircle,
  Layers,
  Settings,
  ArrowLeft
} from "lucide-react";

interface TeacherDashboardProps {
  teacher: UserProfile;
  onLogout: () => void;
  dbRef: any;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout, dbRef }) => {
  const { latitude, longitude, error: locError, refreshLocation, loading: locLoading, isSimulated, setCoords, setSimulatedMode } = useLocation();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [mapMode, setMapMode] = useState<"map" | "radar">("map");
  
  const currentSession = viewingSession || activeSession;
  
  // Navigation Modal control
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  
  // Create Session states
  const [subjectName, setSubjectName] = useState<string>("");
  const [duration, setDuration] = useState<number>(15); // minutes
  const [creating, setCreating] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showMap, setShowMap] = useState<boolean>(false);
  const [showSubjectManager, setShowSubjectManager] = useState<boolean>(false);

  // Subjects Management
  const [subjects, setSubjects] = useState<{ id: string; name: string; teacherUid: string }[]>([]);
  const [newSubjectName, setNewSubjectName] = useState<string>("");
  const [addingSubject, setAddingSubject] = useState<boolean>(false);

  // Real-time analytics stats helper calculations
  const totalCheckedIn = attendances.length;
  const presentCount = attendances.filter((at) => at.status === "present").length;
  const lateCount = attendances.filter((at) => at.status === "late").length;

  const presentPercentage = totalCheckedIn > 0 ? (presentCount / totalCheckedIn) * 100 : 0;
  const latePercentage = totalCheckedIn > 0 ? (lateCount / totalCheckedIn) * 100 : 0;

  // Pie/donut chart geometry variables
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffsetPresent = circumference - (circumference * presentPercentage) / 100;
  const strokeDashoffsetLate = circumference - (circumference * latePercentage) / 100;

  // Listen to subjects (Fetch once per refresh trigger, no need to poll continuously)
  useEffect(() => {
    const unsubscribe = AttendanceService.listenToSubjects(dbRef, teacher.uid, (fetched) => {
      setSubjects(fetched);
    }, 0); // pollInterval = 0 to disable polling
    return () => unsubscribe();
  }, [dbRef, teacher.uid, refreshTrigger]);

  const handleDeleteSubject = async (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation();
    if (!window.confirm("คุณต้องการลบรายวิชานี้ใช่หรือไม่?")) return;
    try {
      await AttendanceService.deleteSubject(dbRef, subjectId);
      setRefreshTrigger(prev => prev + 1); // Trigger refetch
    } catch (err) {
      console.error("Error deleting subject:", err);
    }
  };

  // Listen to all sessions. If no active session, do NOT poll continuously to save API calls.
  // When active session exists, we poll every 3s to keep data live.
  useEffect(() => {
    const shouldPoll = activeSession ? 3000 : 0;
    const unsubscribe = AttendanceService.listenToSessions(dbRef, (fetched) => {
      setSessions(fetched);
      
      // Auto-identify active session if any exists
      // Criteria: active flag == true and expiry time is in the future
      const active = fetched.find(s => s.active && new Date(s.expiresAt).getTime() > Date.now());
      setActiveSession(active || null);
    }, shouldPoll);

    return () => unsubscribe();
  }, [dbRef, activeSession ? true : false, refreshTrigger]);

  // Listen to attendees if there is an active or viewed session
  useEffect(() => {
    if (!currentSession) {
      setAttendances([]);
      return;
    }

    const unsubscribe = AttendanceService.listenToAttendances(dbRef, currentSession.id, (fetched) => {
      setAttendances(fetched);
    });

    return () => unsubscribe();
  }, [currentSession?.id, dbRef]);

  // Countdown timer clock
  useEffect(() => {
    if (!activeSession) return;

    const updateTimer = () => {
      const remaining = new Date(activeSession.expiresAt).getTime() - Date.now();
      
      if (remaining <= 0) {
        setTimeRemaining("หมดเวลาเซสชัน");
        // Auto CLOSE local state if expired
        if (activeSession.active) {
          AttendanceService.toggleSessionActive(dbRef, activeSession.id, false);
        }
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${mins} นาที ${secs} วินาที`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, dbRef]);

  // Create new session submission
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    setCreating(true);
    try {
      // Create session using current location coords
      await AttendanceService.createSession(
        dbRef,
        subjectName,
        duration,
        latitude,
        longitude,
        10, // strict 10 meter radius limit
        teacher
      );
      setSubjectName("");
      setRefreshTrigger(prev => prev + 1); // Trigger refetch to get the newly created session immediately
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async () => {
    if (!activeSession) return;
    const nextState = !activeSession.active;
    await AttendanceService.toggleSessionActive(dbRef, activeSession.id, nextState);
    setRefreshTrigger(prev => prev + 1); // Trigger refetch
  };

  const loadPastSessionDetails = async (session: Session) => {
    setViewingSession(session);
  };

  // Mock export reports to text csv with subject and session header info
  const handleExportCSV = () => {
    if (attendances.length === 0) return;
    
    let csvContent = "";
    
    // Add Subject information headers
    csvContent += `รายงานการเข้าเช็กชื่อเข้าเรียน\n`;
    csvContent += `รายวิชา:,${currentSession?.subjectName || "ไม่ระบุ"}\n`;
    csvContent += `อาจารย์ผู้สอน:,${teacher.name}\n`;
    if (currentSession) {
      const sessionDate = new Date(currentSession.createdAt).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) + " น.";
      csvContent += `เวลาเริ่มเปิดจุด:,${sessionDate}\n`;
    }
    csvContent += `จำนวนนักศึกษาทั้งหมดที่เช็กชื่อ:,${attendances.length} คน\n\n`;
    
    // CSV main data table header
    csvContent += "รหัสนักศึกษา,ชื่อ-นามสกุล,เวลาเช็คชื่อ,ระยะห่าง (เมตร),สถานะ\n";
    
    attendances.forEach((at) => {
      const cleanTime = new Date(at.timestamp).toLocaleTimeString("th-TH");
      csvContent += `${at.studentId},${at.studentName},${cleanTime},${at.distance.toFixed(1)},${at.status === "present" ? "เข้าเรียน" : "สาย"}\n`;
    });

    // Create Blob with BOM header to support Excel UTF-8 in Thai
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานเช็คชื่อ_${currentSession?.subjectName || "วิชา"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Grid Layout splits between Creation/Radar and Attendee Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Creation & Live Controls, coordinate maps) - Span 5 */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create Session Form Card */}
          {!currentSession ? (
            <div id="create-room-heading" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    <span>เปิดจุดเช็คชื่อพิกัดใหม่</span>
                  </h4>
                  <p className="text-[11px] text-slate-450 mt-1">
                    เลือกวิชาและระบุระยะเวลาเพื่อให้นักศึกษาลงชื่อเข้าเรียน
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubjectManager(!showSubjectManager)}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap border shrink-0 ${
                    showSubjectManager 
                      ? "text-slate-600 bg-slate-100 hover:bg-slate-200 border-slate-200" 
                      : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100"
                  }`}
                >
                  {showSubjectManager ? "ปิดหน้าต่าง" : "⚙️ จัดการรายวิชา"}
                </button>
              </div>

              {/* My Subject List (จัดการรายวิชา) */}
              <AnimatePresence>
                {showSubjectManager && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150 mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <span>📚 รายวิชาของคุณที่ประคบประคองไว้ ({subjects.length})</span>
                  </label>
                  <span className="text-[9px] text-[#12b19d] font-bold">คลิกเพื่อเลือกวิชา</span>
                </div>

                {subjects.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                    <p className="text-[10px] text-slate-400">ยังไม่มีรายวิชาที่จำไว้ คุณสามารถเลือกเพิ่มจากวิชาแนะนำด้านล่างได้ทันที</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {["ศท101 สาระแห่งชีวิต", "SWE205 พัฒนาเว็บแอปพลิเคชัน", "ENG112 ภาษาอังกฤษ"].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            AttendanceService.addSubject(dbRef, sug, teacher.uid);
                          }}
                          className="text-[9px] bg-brand-50 border border-brand-100 hover:bg-brand-100 text-[#0b7c6d] px-2 py-0.5 rounded-full font-medium transition cursor-pointer"
                        >
                          + เพิ่ม {sug.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {subjects.map((sub) => {
                      // Count total rounds this specific subject name was launched
                      const previousSessionsCount = sessions.filter(s => 
                        s.subjectName === sub.name || 
                        s.subjectName.toLowerCase().startsWith(sub.name.toLowerCase() + " (ครั้งที่")
                      ).length;

                      return (
                        <div
                          key={sub.id}
                          onClick={() => {
                            const nextRound = previousSessionsCount + 1;
                            setSubjectName(`${sub.name} (ครั้งที่ ${nextRound})`);
                          }}
                          className={`group relative bg-slate-50 border rounded-xl p-2.5 cursor-pointer hover:bg-teal-50/40 transition flex flex-col justify-between ${
                            subjectName.startsWith(sub.name)
                              ? "border-[#12b19d] bg-teal-50/15"
                              : "border-slate-150"
                          }`}
                        >
                          <div className="pr-4">
                            <span className="block text-[11.5px] font-bold text-slate-700 leading-snug group-hover:text-[#12b19d] truncate">
                              {sub.name}
                            </span>
                            <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono text-slate-500">
                              เช็คชื่อไปแล้ว {previousSessionsCount} ครั้ง
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSubject(e, sub.id)}
                            className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 hover:text-rose-500 text-slate-400 p-0.5 rounded transition cursor-pointer"
                            title="ลบรายวิชา"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Add Form Section */}
                <div className="flex gap-1.5 items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-150 focus-within:border-[#12b19d] transition">
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อวิชาใหม่เพื่อบันทึก เช่น คพ102 ฟิสิกส์"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const btn = document.getElementById("add-sub-inline-btn");
                        if (btn) btn.click();
                      }
                    }}
                  />
                  <button
                    id="add-sub-inline-btn"
                    type="button"
                    disabled={addingSubject || !newSubjectName.trim()}
                    onClick={async () => {
                      if (!newSubjectName.trim()) return;
                      await AttendanceService.addSubject(dbRef, newSubjectName.trim(), teacher.uid);
                      setNewSubjectName("");
                      setRefreshTrigger(prev => prev + 1); // Trigger refetch
                    }}
                    className="bg-[#12b19d] hover:bg-[#0fa18e] disabled:opacity-50 text-white text-[11px] rounded-xl px-3.5 py-1.5 font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มวิชา</span>
                  </button>
                    </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleCreateSession} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      รายวิชาที่จะเปิดรับเช็คชื่อ (เลือกจากรายการ)
                    </label>
                    {subjectName && (
                      <button
                        type="button"
                        onClick={() => setSubjectName("")}
                        className="text-[10px] text-rose-500 font-semibold hover:underline cursor-pointer"
                      >
                        ล้างค่าการเลือก
                      </button>
                    )}
                  </div>
                  <select
                    required
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:border-[#12b19d] focus:outline-none cursor-pointer"
                  >
                    <option value="">-- กรุณาเลือกวิชาที่ต้องการเช็คชื่อ --</option>
                    {subjects.map((sub) => {
                      const previousSessionsCount = sessions.filter(s => 
                        s.subjectName === sub.name || 
                        s.subjectName.toLowerCase().startsWith(sub.name.toLowerCase() + " (ครั้งที่")
                      ).length;
                      const nextRoundName = `${sub.name} (ครั้งที่ ${previousSessionsCount + 1})`;
                      return (
                        <option key={sub.id} value={nextRoundName}>
                          {sub.name} [ครั้งที่ {previousSessionsCount + 1}] (เช็คแล้ว {previousSessionsCount} ครั้ง)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    ระยะเปิดโอกาสให้เช็คชื่อ (นาที):
                    <span className="ml-2 font-mono font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                      {duration} นาที
                    </span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full accent-[#12b19d] h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>

                {/* Location Settings */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-slate-700">พิกัดเปิดรับเช็คชื่อ (รัศมี 10 เมตร)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 border border-emerald-100/50 transition font-medium"
                    >
                      {showMap ? "ซ่อนแผนที่" : "ปรับพิกัดด้วยตัวเอง"}
                    </button>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {!showMap ? (
                      <motion.div
                        key="status-badge"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-[10px] text-emerald-650 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div>
                          <span className="block font-semibold">ระบบพร้อมใช้งานพิกัดปัจจุบันของอาจารย์</span>
                          <span className="block text-emerald-600/80 mt-0.5">พิกัดจะถูกล็อกทันทีที่กดปุ่มเปิดจุดเซ็คชื่อด้านล่าง</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="interactive-map"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden pt-1"
                      >
                        <ClassroomSelectorMap 
                          latitude={latitude}
                          longitude={longitude}
                          onChange={(lat, lng) => {
                            setCoords(lat, lng);
                            setSimulatedMode(true); // Lock coordinates when user drags specifically to prevent background jitter
                          }}
                          onFetchGps={async () => {
                            setSimulatedMode(false); // Disable override to catch real satellite lock
                            await refreshLocation();
                          }}
                          locLoading={locLoading}
                        />

                        {locError ? (
                          <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-100 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                            <span>{locError} (สามารถกดลากพินสีส้มบนแผนที่ เพื่อระบุพิกัดห้องเรียนเองได้)</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 bg-emerald-50/60 p-2 rounded-xl border border-emerald-100/50 flex items-center gap-1.5 font-medium leading-normal">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>ระบบเชื่อมต่อแผนที่พร้อมใช้งาน รัศมีรอบพิน 10 เมตร</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-[#12b19d] hover:bg-[#0fa18e] text-white font-medium text-xs rounded-xl py-2.5 mt-2 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{creating ? "กำลังเริ่มบันทึก..." : "เปิดจุดเซ็คชื่อทันที"}</span>
                </button>
              </form>
            </div>
          ) : (
            /* Active Live Controls Card or Past Session Viewer */
            <div className="bg-gradient-to-br from-slate-900 via-[#012d27] to-slate-950 text-white rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8 blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-teal-900/40 pb-3">
                <div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                    viewingSession 
                      ? "text-teal-400 bg-teal-400/15" 
                      : "text-emerald-400 bg-emerald-400/15"
                  }`}>
                    {viewingSession ? "History View (ประวัติ)" : "Live Session"}
                  </span>
                  <h4 className="font-bold text-base mt-1.5 text-teal-50 leading-tight">
                    {currentSession.subjectName}
                  </h4>
                </div>
                <div className={`p-2 rounded-full ${currentSession.active && !viewingSession ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  <Timer className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[9px] text-[#12b19d] font-mono font-semibold">พิกัดล็อกกลาง:</span>
                    <span className="text-[11px] font-mono font-semibold text-slate-100">
                      {currentSession.latitude.toFixed(4)}, {currentSession.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[9px] text-[#12b19d] font-mono font-semibold">ระยะห้ามเกิน:</span>
                    <span className="text-[11px] font-semibold text-emerald-400">
                      {currentSession.radius} เมตร (เคร่งครัด)
                    </span>
                  </div>
                </div>

                {viewingSession ? (
                  <div className="bg-teal-950/40 p-3 rounded-2xl border border-teal-500/25 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] text-teal-300">วันที่ทำกิจกรรมคลาส:</span>
                        <span className="text-xs font-mono font-semibold text-slate-100">
                          {new Date(viewingSession.createdAt).toLocaleString("th-TH")}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-teal-950/40 p-3 rounded-2xl border border-teal-500/25 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] text-teal-300">เวลาคงเหลือเช็คชื่อ:</span>
                        <span className="text-xs font-mono font-bold text-slate-100">{timeRemaining}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {viewingSession ? (
                    <button
                      onClick={() => setViewingSession(null)}
                      className="w-full py-2.5 px-3 bg-teal-500 hover:bg-teal-600 rounded-xl text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>ปิดรายงานประวัติ (กลับหน้าหลัก)</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleToggleActive}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          activeSession?.active
                            ? "bg-amber-400 hover:bg-amber-500 text-indigo-950"
                            : "bg-emerald-500 hover:bg-emerald-600 text-white"
                        }`}
                      >
                        {activeSession?.active ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>หยุดรับเช็คชื่อชั่วคราว</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>เปิดรับเช็คชื่ออีกครั้ง</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (activeSession) {
                            await AttendanceService.toggleSessionActive(dbRef, activeSession.id, false);
                            setActiveSession(null);
                            setRefreshTrigger(prev => prev + 1);
                          }
                        }}
                        className="py-2.5 px-3 bg-white/10 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 rounded-xl text-xs font-semibold text-slate-200 hover:text-rose-400 transition"
                      >
                        ปิดเซสชันนี้
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Location Simulator inside Teacher view for developer convenience */}
          {isSimulated && <ManualLocationSimulator activeSession={activeSession} />}

          {/* PREVIOUS SESSION ARCHIVES LIST */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">
              ข้อมูลเซสชันก่อนหน้านี้ ({sessions.length})
            </h4>
            
            <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
              {sessions.filter(s => s.id !== currentSession?.id).slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadPastSessionDetails(session)}
                  className="w-full flex items-center justify-between text-left p-2.5 rounded-xl border border-slate-150 hover:bg-slate-50 transition"
                >
                  <div className="truncate pr-2">
                    <span className="block text-[10px] font-bold text-slate-800 truncate">
                      {session.subjectName}
                    </span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">
                      {new Date(session.createdAt).toLocaleDateString("th-TH")} • รัศมี {session.radius}m
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono bg-slate-100 text-slate-650 px-2 py-0.5 rounded-full font-medium">
                    ดูประวัติ
                  </span>
                </button>
              ))}
              
              {sessions.filter(s => s.id !== currentSession?.id).length === 0 && (
                <p className="text-slate-400 text-center text-xs py-4 italic">ไม่มีประวัติคาบเรียนก่อนหน้านี้</p>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Live Attendees and Radar Display Graph) - Span 7 */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Real-time Attendance Statistics Summary Card */}
          {currentSession && (
            <div id="analytics-panel" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#12b19d]/10 text-[#12b19d] rounded-xl">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
                      สรุปสถิติคลาสเรียนเรียลไทม์
                    </h4>
                    <p className="text-[10px] text-slate-450 font-medium">
                      วิเคราะห์สัดส่วนกลุ่มผู้เรียนประพฤติตรงเวลาแยกตามช่วงเวลาเซสชัน
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-[#12b19d] bg-teal-50/80 border border-teal-100/50 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#12b19d] rounded-full animate-ping" />
                  Live Sync
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Statistics Numerical Grid (8 cols) */}
                <div className="md:col-span-8 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Card 1: Total */}
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-semibold text-slate-450 uppercase flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-450" />
                        <span>เช็กชื่อรวม</span>
                      </span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-mono font-black text-slate-800">
                          {totalCheckedIn}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-450">คน</span>
                      </div>
                    </div>

                    {/* Card 2: Present */}
                    <div className="bg-emerald-50/30 border border-emerald-100/50 p-3 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-semibold text-emerald-800 uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#12b19d]" />
                        <span>ตรงเวลา</span>
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl font-mono font-black text-[#12b19d]">
                            {presentCount}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-450">คน</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#0fa18e] bg-teal-50 px-1 py-0.2 rounded">
                          {presentPercentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Card 3: Late */}
                    <div className="bg-amber-50/40 border border-amber-100/50 p-3 rounded-2xl flex flex-col justify-between">
                      <span className="text-[9px] font-semibold text-amber-850 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>เข้าเรียนสาย</span>
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl font-mono font-black text-amber-600">
                            {lateCount}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-450">คน</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50/50 px-1 py-0.2 rounded">
                          {latePercentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Stacked Bar */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-150">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-[#12b19d]" />
                        <span>กราฟวิเคราะห์สัดส่วนการมาเรียน</span>
                      </span>
                      <span>
                        {totalCheckedIn === 0 
                          ? "ยังไม่มีข้อมูลเช็กชื่อในคาบเรียนนี้" 
                          : `ตรงเวลา ${presentPercentage.toFixed(0)}% | สาย ${latePercentage.toFixed(0)}%`
                        }
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                      {totalCheckedIn > 0 ? (
                        <>
                          <div 
                            style={{ width: `${presentPercentage}%` }} 
                            className="bg-[#12b19d] h-full transition-all duration-700 pointer-events-none"
                          />
                          <div 
                            style={{ width: `${latePercentage}%` }} 
                            className="bg-amber-500 h-full transition-all duration-700 pointer-events-none"
                          />
                        </>
                      ) : (
                        <div className="w-full bg-slate-200 h-full flex items-center justify-center text-[8px] text-slate-400 font-bold tracking-wider uppercase">
                          No Data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Symmetrical High-Fidelity SVG Donut Chart (4 cols) */}
                <div className="md:col-span-4 flex flex-col items-center justify-center">
                  <div className="relative w-28 h-28">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {/* Gray track background */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="11"
                      />
                      
                      {totalCheckedIn === 0 ? (
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke="#e2e8f0"
                          strokeWidth="11"
                        />
                      ) : (
                        <>
                          {presentCount > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#12b19d"
                              strokeWidth="11"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffsetPresent}
                              className="transition-all duration-700 ease-in-out"
                            />
                          )}
                          {lateCount > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#f59e0b"
                              strokeWidth="11"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffsetLate}
                              transform={`rotate(${(presentPercentage * 360) / 100} 50 50)`}
                              className="transition-all duration-700 ease-in-out"
                            />
                          )}
                        </>
                      )}
                    </svg>

                    {/* Donut central stats badge overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-mono font-black text-slate-800 leading-none">
                        {totalCheckedIn}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                        รายชื่อรวม
                      </span>
                    </div>
                  </div>
                  
                  {/* Miniature legend badge */}
                  <div className="flex gap-2.5 mt-2 justify-center">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#12b19d]" />
                      <span className="text-[9px] font-bold text-slate-500">ตรงเวลา</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[9px] font-bold text-slate-500">มาสาย</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Visual Radar Widget - left segment of right panel (Spans 5 on standard layout) */}
            <div id="radar-pane-wrapper" className="md:col-span-5 flex flex-col justify-start">
              {currentSession ? (
                <div className="space-y-4">
                  {/* Mode switcher tabs */}
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMapMode("map")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        mapMode === "map"
                          ? "bg-white text-[#12b19d] shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>แผนที่พิกด (Map)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapMode("radar")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        mapMode === "radar"
                          ? "bg-white text-[#12b19d] shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>เรดาร์ (Radar)</span>
                    </button>
                  </div>

                  {mapMode === "map" ? (
                    <AttendanceMap session={currentSession} attendances={attendances} isStudentView={false} heightClass="h-[280px]" />
                  ) : (
                    <ClassroomRadar session={currentSession} attendances={attendances} />
                  )}
                  <div className="bg-brand-50 border border-brand-100 p-3.5 rounded-2xl">
                    <h5 className="font-bold text-[11px] text-[#0b7c6d] flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-[#12b19d]" />
                      <span>คำนวณระยะอัตโนมัติ API</span>
                    </h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed mt-1">
                      ระบบจะปฏิเสธการกดเช็คชื่อหากนักศึกษาอยู่ห่างจาก พิกัดห้องเรียน เกิน 10 เมตร โดยตรวจสอบผ่าน Geolocation ความแม่นยำสูง
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-450 min-h-[350px]">
                  <Users className="w-10 h-10 text-slate-350 mb-2 stroke-1" />
                  <p className="text-xs font-semibold">เมื่อเปิดรายวิชาแล้ว</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                    แผนที่เรดาร์พิกัด 10 เมตร และตำแหน่งของนักศึกษาจะปรากฏขึ้นเรียลไทม์ที่นี่
                  </p>
                </div>
              )}
            </div>

            {/* List Table of Attendees - right segment of right panel (Spans 7) */}
            <div className="md:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 min-h-[350px] flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#12b19d]" />
                      <span>รายชื่อนักศึกษาเช็คชื่อเข้าห้องเรียน</span>
                    </h4>
                    <p className="text-[11px] text-slate-450 mt-0.5">
                      จำนวนเข้าเรียนทั้งหมด: <span className="font-bold text-brand-700 font-mono bg-brand-50 px-1.5 py-0.5 rounded">{attendances.length} คน</span>
                    </p>
                  </div>
                  {attendances.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="px-2.5 py-1.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-emerald-300" />
                      Export
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 text-slate-450 font-semibold text-[10px] uppercase font-mono tracking-wider">
                        <th className="pb-2 font-medium">รหัสนักศึกษา</th>
                        <th className="pb-2 font-medium">ชื่อ-นามสกุล</th>
                        <th className="pb-2 font-medium">เวลาเข้า</th>
                        <th className="pb-2 font-medium text-center">ระยะ (เมตร)</th>
                        <th className="pb-2 font-medium text-right">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendances.map((at) => (
                        <tr key={at.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 font-mono text-[11px] font-bold text-slate-800">{at.studentId}</td>
                          <td className="py-2.5 font-medium text-slate-750">{at.studentName}</td>
                          <td className="py-2.5 text-slate-450 font-mono text-[11px]">
                            {new Date(at.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="py-2.5 text-center font-mono text-[11px] text-slate-650">
                            {at.distance.toFixed(1)} ม.
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              at.status === "present"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {at.status === "present" ? "เข้าเรียน" : "สาย"}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {attendances.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                            ยังไม่มีนักศึกษากดเช็คชื่อเข้าร่วมในเซสชันนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Navigation Modal */}
      <AnimatePresence>
        {isNavOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="nav-modal">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNavOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            {/* Sidebar drawer container */}
            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="w-screen max-w-sm bg-white shadow-2xl flex flex-col justify-between"
              >
                {/* Header Section */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-brand-50 text-[#12b19d] rounded-xl">
                      <Settings className="w-5 h-5 text-[#12b19d]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">เมนูควบคุม PharmCheck</h3>
                      <p className="text-[10px] text-[#12b19d] font-black tracking-wide uppercase">Teacher Workspace</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsNavOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile Details Card in Menu */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#12b19d] to-teal-400 text-white flex items-center justify-center font-black text-base shadow-sm">
                      {teacher.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm leading-none">{teacher.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">{teacher.email}</p>
                      <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-105 text-[#0f8b7b]">
                        อาจารย์ผู้สอน
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation Links List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">บทเรียนและการจัดเก็บบันทึก</span>
                    
                    {/* Link 1: Create room */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        const el = document.getElementById("create-room-heading");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth" });
                        } else {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Plus className="w-4 h-4 text-slate-500 group-hover:text-[#12b19d]" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">จัดการรายวิชาและเปิดบันทึก ใหม่</p>
                          <p className="text-[10px] text-slate-450">ควบคุมระบบจดพิกัดรายวิชาเพื่อเช็คชื่อ</p>
                        </div>
                      </div>
                    </button>

                    {/* Link 2: Live Analytics stats */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        const el = document.getElementById("analytics-panel");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <PieChart className="w-4 h-4 text-slate-500 group-hover:text-[#12b19d]" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">ดูสถิติคลาสเรียนเรียลไทม์</p>
                          <p className="text-[10px] text-slate-450">สัดส่วนนักศึกษาตรงเวลา / มาสาย</p>
                        </div>
                      </div>
                    </button>

                    {/* Link 3: Map View */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        setMapMode("map");
                        const el = document.getElementById("radar-pane-wrapper");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-slate-500 group-hover:text-[#12b19d]" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">แสดงพิกัดแผนที่เรียนจริง</p>
                          <p className="text-[10px] text-slate-450">ระบุพิกัด Map GPS 10 เมตร</p>
                        </div>
                      </div>
                    </button>

                    {/* Link 4: Export CSV */}
                    <button
                      disabled={attendances.length === 0}
                      onClick={() => {
                        setIsNavOpen(false);
                        handleExportCSV();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50/70 disabled:opacity-40 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Download className="w-4 h-4 text-slate-500 group-hover:text-[#12b19d]" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">ดาวน์โหลดรายงานดิบ (.csv)</p>
                          <p className="text-[10px] text-slate-450">เซฟตารางรายชื่อลงเครื่องมือ Excel</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ความช่วยเหลือและระบบ</span>
                    
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="text-[10px] font-bold text-slate-700">คำเตือนการปักพิกัด</div>
                      <div className="text-[9px] text-slate-500 leading-normal">
                        กรุณากดอนุญาตสิทธิ์ตำแหน่ง GPS บนเบราว์เซอร์ของท่านทุกครั้งเพื่อให้ระบบคำนวณวงพิกัด 10 เมตรได้อย่างรวดเร็วและแม่นยำ
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer segment layout */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/80 space-y-3">
                  <button
                    onClick={() => {
                      setIsNavOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบการทำงาน</span>
                  </button>
                  <p className="text-[10px] text-slate-450 font-medium text-center">
                    PharmCheck v1.2.5 • Smart QR & Geo Radar System
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
