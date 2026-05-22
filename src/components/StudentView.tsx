import React, { useState, useEffect } from "react";
import { Session, Attendance, UserProfile } from "../types";
import { AttendanceService } from "../services/attendanceService";
import { useLocation } from "./LocationContext";
import { AttendanceMap } from "./AttendanceMap";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, 
  Compass, 
  CheckCircle, 
  AlertTriangle, 
  LogOut, 
  RefreshCw, 
  BookOpen, 
  Fingerprint, 
  FileCheck, 
  MapPinOff,
  User,
  ArrowRight,
  ClipboardList,
  X,
  Settings,
  HelpCircle,
  Clock,
  Layers
} from "lucide-react";

interface StudentViewProps {
  student: UserProfile;
  onLogout: () => void;
  dbRef: any;
}

// Haversine distance formula in meters
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export const StudentView: React.FC<StudentViewProps> = ({ student, onLogout, dbRef }) => {
  const { latitude, longitude, accuracy, isSimulated, setCoords, refreshLocation, loading: locLoading, error: locError } = useLocation();

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState<boolean>(false);
  const [checkInReceipt, setCheckInReceipt] = useState<{ time: string; distance: number; key: string } | null>(null);
  const [personalHistory, setPersonalHistory] = useState<Attendance[]>([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<boolean>(false);
  const [mapMode, setMapMode] = useState<"map" | "compass">("map");

  // Navigation Panel state
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  // 1. Fetch available active session
  useEffect(() => {
    const unsubscribe = AttendanceService.listenToSessions(dbRef, (sessions) => {
      // Find session that is active and hasn't expired yet
      const live = sessions.find(s => s.active && new Date(s.expiresAt).getTime() > Date.now());
      setActiveSession(live || null);
    });

    return () => unsubscribe();
  }, [dbRef]);

  // 2. Calculate distance whenever coordinates or active session coordinates update
  useEffect(() => {
    if (!activeSession) {
      setDistance(null);
      return;
    }

    const calculated = calculateHaversineDistance(
      latitude,
      longitude,
      activeSession.latitude,
      activeSession.longitude
    );
    setDistance(calculated);
  }, [latitude, longitude, activeSession]);

  // 3. Listen to single-student check-in state to verify if they are already recorded
  useEffect(() => {
    if (!activeSession) {
      setAlreadyCheckedIn(false);
      return;
    }

    const unsubscribe = AttendanceService.listenToAttendances(dbRef, activeSession.id, (records) => {
      const match = records.find(r => r.studentUid === student.uid);
      if (match) {
        setAlreadyCheckedIn(true);
        setCheckInReceipt({
          time: new Date(match.timestamp).toLocaleTimeString("th-TH"),
          distance: match.distance,
          key: match.id || ""
        });
      } else {
        setAlreadyCheckedIn(false);
        setCheckInReceipt(null);
      }
    });

    return () => unsubscribe();
  }, [activeSession, student.uid, dbRef]);

  // Submit student check-in
  const handleCheckInSubmit = async () => {
    if (!activeSession || distance === null || distance > 10 || alreadyCheckedIn) return;

    setCheckingIn(true);
    try {
      const status: "present" | "late" = "present"; // Present within open session window

      await AttendanceService.submitCheckIn(
        dbRef,
        activeSession.id,
        student,
        { latitude, longitude },
        distance,
        status
      );

      // Track to receipt
      setCheckInReceipt({
        time: new Date().toLocaleTimeString("th-TH"),
        distance: distance,
        key: `TXN_${student.studentId}_${activeSession.id.slice(-4).toUpperCase()}`
      });
      setAlreadyCheckedIn(true);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingIn(false);
    }
  };

  // Real-time position tracking update on PostgreSQL server for checked-in students
  useEffect(() => {
    if (!activeSession || distance === null || !alreadyCheckedIn) return;

    const timeoutId = setTimeout(async () => {
      try {
        await AttendanceService.submitCheckIn(
          dbRef,
          activeSession.id,
          student,
          { latitude, longitude },
          distance,
          "present"
        );
      } catch (err) {
        console.error("Failed to sync background location:", err);
      }
    }, 1500); // 1.5s debounce to keep Neon PG updates efficient and high-performance

    return () => clearTimeout(timeoutId);
  }, [latitude, longitude, distance, activeSession, alreadyCheckedIn, student, dbRef]);

  // Quick helper to move student coordinates right to class central location to play inside mock easily
  const handleTeleportToClassInOneClick = () => {
    if (!activeSession) return;
    // Offset slightly by 2 meters from class center (latitude offset 2m)
    const metersPerLatDegree = 111139;
    const latOffset = 2 / metersPerLatDegree;

    setCoords(
      activeSession.latitude + latOffset,
      activeSession.longitude,
      1.2
    );
  };

  const isTooFar = distance === null || distance > 10;

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Main Attendance Module Section */}
      <div id="attendance-panel" className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between">
        
        {/* Course details header inside student module */}
        <div className="bg-slate-900 text-white p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold">
              วิชาที่เปิดลงชื่อเข้าเรียนในขณะนี้
            </span>
          </div>

          {activeSession ? (
            <div className="mt-3">
              <h4 className="text-base font-bold text-slate-50 leading-snug">{activeSession.subjectName}</h4>
              <p className="text-[10px] text-slate-400 mt-1">
                สร้างโดย: {activeSession.teacherName} ({activeSession.teacherEmail})
              </p>
            </div>
          ) : (
            <div className="mt-4 py-2">
              <h4 className="text-sm font-semibold text-slate-300 italic">ไม่มีคาบเรียนอื่นที่เปิดเช็คชื่อในตอนนี้</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                กรุณารอให้อาจารย์กดเปิดเซสชันการเช็คชื่อผู้เข้าเรียนในห้องเรียนก่อน แล้วหน้าจอนี้จะรับสัญญาณพิกัดโดยอัตโนมัติ
              </p>
            </div>
          )}
        </div>

        {/* GPS Radar Target Meter Dashboard */}
        {activeSession && (
          <div className="p-5 space-y-5">
            
            {/* Visual Radar Indicator Card with colors */}
            <div className="flex flex-col items-center justify-center py-5 px-4 bg-slate-50 border border-slate-150 rounded-2xl relative overflow-hidden">
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-25">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] font-mono font-medium text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-100 shadow-sm font-semibold">Live GPS</span>
              </div>

              {/* Mode switcher tabs */}
              <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-0.5 rounded-lg w-full max-w-[240px] mb-4 relative z-20">
                <button
                  type="button"
                  onClick={() => setMapMode("map")}
                  className={`py-1 rounded-md text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    mapMode === "map"
                      ? "bg-white text-[#12b19d] shadow-sm"
                      : "text-slate-550 hover:text-slate-800"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>แผนที่ 2D</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode("compass")}
                  className={`py-1 rounded-md text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    mapMode === "compass"
                      ? "bg-white text-[#12b19d] shadow-sm"
                      : "text-slate-550 hover:text-slate-800"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>เรดาร์เข็มทิศ</span>
                </button>
              </div>

              {mapMode === "map" ? (
                /* INTERACTIVE MAP COMPONENT */
                <div className="w-full space-y-4 relative z-10">
                  <AttendanceMap
                    session={activeSession}
                    studentCoords={{ latitude, longitude }}
                    accuracy={accuracy}
                    isStudentView={true}
                    heightClass="h-[185px]"
                  />
                  
                  <div className="text-center space-y-0.5">
                    <span className="text-[9px] text-slate-450 font-mono tracking-wider font-semibold uppercase">
                      ระยะห่างขณะนี้
                    </span>
                    <h3 className={`text-xl font-black font-mono tracking-tight ${isTooFar ? "text-amber-500" : "text-emerald-650 animate-pulse"}`}>
                      {distance ? `${distance.toFixed(1)} เมตร` : "กำลังตรวจพิกัด..."}
                    </h3>
                  </div>

                  {/* Range indicator box */}
                  {isTooFar ? (
                    <div className="p-2 bg-amber-50 border border-amber-150 rounded-xl text-[10px] text-amber-850 leading-relaxed font-sans flex items-start gap-1.5 text-left">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        อยู่นอกระยะเช็คชื่อ (&gt;10ม.) กรุณากดเดินเข้าห้องเรียน
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] text-emerald-850 leading-relaxed font-sans flex items-start gap-1.5 text-left">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                      <div>
                        อยู่ในพิกัดพร้อมลงชื่อ (≤10ม.) เช็คชื่อได้ทันทีด้านล่าง
                      </div>
                    </div>
                  )}
                </div>
              ) : alreadyCheckedIn ? (
                /* CHECKED IN CONGRATS RECEIPT STATE */
                <div className="text-center space-y-4 py-2 w-full animate-fadeIn">
                  <div className="w-14 h-14 bg-emerald-100 border-2 border-emerald-400 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle className="w-8 h-8 fill-current text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-emerald-650 text-sm">เช็คชื่อเข้าเรียนสำเร็จแล้ว!</h5>
                    <p className="text-[10px] text-slate-450 mt-1 font-mono">
                      ระบบตรวจระดับพิกัดเรียบร้อย พิกัดตรงตามเงื่อนไขมหาวิทยาลัย
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-left space-y-1.5 max-w-[240px] mx-auto text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-450">เวลาเช็คชื่อ:</span>
                      <span className="font-bold text-slate-800">{checkInReceipt?.time} น.</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">ระยะห่างเซ็นเซอร์:</span>
                      <span className="font-bold text-slate-800">{checkInReceipt?.distance.toFixed(1)} เมตร</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">รหัสยืนยัน TXN:</span>
                      <span className="font-bold text-brand-700">{checkInReceipt?.key.slice(0, 14)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ACTIVE DETECTION RADAR STATE */
                <>
                  {/* Proximity Ring */}
                  <div className="relative mb-4">
                    <div className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all ${
                      isTooFar 
                        ? "border-amber-400 bg-amber-500/5 text-amber-500 shadow-amber-100/40 shadow-lg" 
                        : "border-emerald-500 bg-emerald-500/5 text-emerald-600 shadow-emerald-100/40 shadow-lg"
                    }`}>
                      <Compass className={`w-12 h-12 stroke-1.5 ${isTooFar ? "" : "animate-spin-slow"}`} />
                    </div>
                  </div>

                  <div className="text-center space-y-1 w-full px-2">
                    <span className="text-[10px] text-slate-450 font-mono tracking-wider font-semibold uppercase">
                      ระยะห่างปัจจุบันของคุณถึงห้องเรียน
                    </span>
                    <h3 className={`text-2xl font-black font-mono tracking-tight ${isTooFar ? "text-amber-500" : "text-emerald-650 animate-pulse"}`}>
                      {distance ? `${distance.toFixed(1)} เมตร` : "กำลังตรวจพิกัด..."}
                    </h3>
                  </div>

                  {/* Thai dynamic range helper notification box */}
                  {isTooFar ? (
                    <div className="mt-3 p-2.5 bg-amber-50 border border-amber-150 rounded-xl text-[10px] text-amber-850 leading-relaxed font-sans flex items-start gap-1.5 text-left">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        <b>อยู่นอกพิกัดเช็คชื่อ:</b> คุณอยู่ไกลเกินรัศมี 10 เมตร หากเข้ารับการสอนแล้วกรุณาขยับโทรศัพท์ หรือเปิด <b>"จำลองพิกัด 2 เมตร"</b> ด้านล่าง
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] text-emerald-850 leading-relaxed font-sans flex items-start gap-1.5 text-left">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                      <div>
                        <b>อยู่ในพิกัดพร้อมลงชื่อ:</b> พิกัดของคุณถูกต้องและอยู่ในระยะห้องเรียนกว้าง 10 เมตร สามารถคลิกปุ่มล็อคเช็คชื่อได้ทันทีด้านล่าง
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Simulated test button within students reach for quick verification */}
            {isTooFar && !alreadyCheckedIn && isSimulated && (
              <button
                type="button"
                onClick={handleTeleportToClassInOneClick}
                className="w-full bg-slate-900 border border-[#12b19d] hover:bg-slate-800 text-white rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 text-[11px] font-mono tracking-wide transition shadow cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5 text-[#12b19d]" />
                <span>จำลองการเดินเข้าห้องเรียน (2 เมตร) เพื่อลองเช็คชื่อ</span>
              </button>
            )}

            {/* GPS Accuracy Status List */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 bg-slate-50 p-2 text-center rounded-lg border border-slate-150">
              <div>
                <span>ความคลาดเคลื่อน GPS:</span>
                <span className="block font-bold text-slate-800">{accuracy ? `+/- ${accuracy.toFixed(1)} เมตร` : "N/A"}</span>
              </div>
              <div>
                <span>แหล่งข้อมูล:</span>
                <span className="block font-bold text-brand-700">{isSimulated ? "SIMULATOR" : "HARDWARE GPS"}</span>
              </div>
            </div>

            {/* Checkin Action Buttons */}
            {!alreadyCheckedIn ? (
              <button
                onClick={handleCheckInSubmit}
                disabled={isTooFar || checkingIn}
                className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold leading-normal text-center flex items-center justify-center gap-2 shadow transition-all ${
                  isTooFar 
                    ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                    : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01] hover:shadow-lg active:scale-95 cursor-pointer cursor-pulse"
                }`}
              >
                <Fingerprint className="w-4 h-4 text-emerald-100" />
                <span>{checkingIn ? "กำลังส่งบันทึก..." : "ยืนยันและเช็คชื่อเข้าชั้นเรียน"}</span>
              </button>
            ) : (
              <div className="border border-slate-150 p-3 bg-slate-50/50 rounded-xl space-y-1">
                <span className="block text-[9.5px] uppercase font-bold tracking-wider font-mono text-slate-400">สถานะคาบนี้</span>
                <div className="flex items-center gap-1.5 text-xs text-emerald-650 font-bold">
                  <CheckCircle className="w-4 h-4 fill-current text-white" />
                  <span>บันทึกประวัติร่วมกิจกรรมแล้ว เรียบร้อยดี</span>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Dynamic Instruction guide card */}
      <div id="student-instructions-card" className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-2">
        <h5 className="font-bold text-xs text-slate-850 flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <span>เงื่อนไขพิกัด 10 เมตร คืออะไร?</span>
        </h5>
        <div className="text-[10px] text-slate-500 leading-relaxed space-y-1 font-sans">
          <p>
            1. ระบบเช็คชื่อนี้อ้างอิงกับพิกัด ละติจูด / ลองจิจูด ที่คอมพิวเตอร์ของอาจารย์ผู้สอนล็อกตัวตนเอาไว้ในกระดานบอร์ด
          </p>
          <p>
            2. นักศึกษาจะต้องล็อกอินผ่านมือถือโดยเปิดใช้งานสัญลักษณ์ GPS บนหน้าเบราว์เซอร์ แล้วตรวจสอบระยะห่างให้เหลือน้อยกว่า 10 เมตรจึงจะกดเช็คชื่อผ่านได้
          </p>
        </div>
      </div>

      {/* Navigation Modal */}
      <AnimatePresence>
        {isNavOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="student-nav-modal">
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
                <div className="p-6 border-b border-slate-105 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Settings className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">เมนูควบคุม PharmCheck</h3>
                      <p className="text-[10px] text-emerald-600 font-black tracking-wide uppercase">Student Workspace</p>
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-black text-base shadow-sm">
                      {student.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm leading-none">{student.name}</h4>
                      <p className="text-[9.5px] text-slate-500 font-mono mt-1">ID: {student.studentId}</p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">{student.email}</p>
                      <span className="inline-flex mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-850">
                        นักศึกษา
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation Links List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">บทเรียนและการเข้าเรียน</span>
                    
                    {/* Link 1: Active checking session */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        const el = document.getElementById("attendance-panel");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-emerald-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">เช็กชื่อเข้าห้องเรียน (คลาสสด)</p>
                          <p className="text-[10px] text-slate-450">ตรวจสอบพิกัดตำแหน่งจริงแชร์เข้าแผนที่</p>
                        </div>
                      </div>
                    </button>

                    {/* Link 2: Map mode switcher toggles */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        setMapMode(mapMode === "map" ? "compass" : "map");
                        const el = document.getElementById("attendance-panel");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Compass className="w-4 h-4 text-slate-500 group-hover:text-emerald-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">สลับรูปแบบแผนที่/เรดาร์เข็มทิศ</p>
                          <p className="text-[10px] text-slate-450">มุมมองปัจจุบัน: {mapMode === "map" ? "แผนที่ 2D" : "เรดาร์เข็มทิศ"}</p>
                        </div>
                      </div>
                    </button>

                    {/* Link 3: Simulator Teleport (Only when simulator mode acts) */}
                    {isSimulated && (
                      <button
                        onClick={() => {
                          setIsNavOpen(false);
                          handleTeleportToClassInOneClick();
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer text-emerald-700 animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-emerald-555 group-hover:text-emerald-655" />
                          <div>
                            <p className="text-xs font-bold text-[#0fa18e] group-hover:text-emerald-800">Teleport เดินเข้าห้องเรียน (2ม.)</p>
                            <p className="text-[10px] text-[#0fa18e]/80">ส่งตำแหน่งจำลองพิกัดโดยอัตโนมัติ</p>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Link 4: Guide help */}
                    <button
                      onClick={() => {
                        setIsNavOpen(false);
                        const el = document.getElementById("student-instructions-card");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 text-left transition group border border-transparent hover:border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <HelpCircle className="w-4 h-4 text-slate-500 group-hover:text-emerald-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900">ดูเงื่อนไขพิกัดความปลอดภัย</p>
                          <p className="text-[10px] text-slate-450">คู่มือแนะนำขอบเขตกว้าง 10 เมตร</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ความปลอดภัยข้อมูล</span>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="text-[10px] font-bold text-slate-700">ยืนยันตัวตนจริงของเบราว์เซอร์</div>
                      <div className="text-[9px] text-slate-500 leading-normal">
                        พิกัดทางภูมิศาสตร์ถูกคำนวณผ่านเบราว์เซอร์แบบเข้ารหัส และใช้ส่งเพื่อประโยชน์สูงสุดในการลงชื่อเข้าชั้นเรียนเท่านั้น มหาวิทยาลัยจะไม่เก็บพิกัดส่วนตัวเป็นประวัติคงเหลือหลัก
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-650 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
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
