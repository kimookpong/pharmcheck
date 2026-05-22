import React, { useEffect, useState } from "react";
import { useLocation } from "./LocationContext";
import { Session } from "../types";
import { MapPin, HelpCircle, Eye, EyeOff, Sliders } from "lucide-react";

interface ManualLocationSimulatorProps {
  activeSession: Session | null;
}

export const ManualLocationSimulator: React.FC<ManualLocationSimulatorProps> = ({ activeSession }) => {
  const { 
    latitude, 
    longitude, 
    isSimulated, 
    setCoords, 
    setSimulatedMode, 
    refreshLocation 
  } = useLocation();

  const [simulatedDistance, setSimulatedDistance] = useState<number>(3); // Default 3 meters (In-Range)
  const [isOpen, setIsOpen] = useState<boolean>(true); // Keep open initially for quick grading visibility

  // Watch slide changes and update locations dynamically relative to the classroom session
  useEffect(() => {
    if (!isSimulated || !activeSession) return;

    // 1 meter offset of latitude is approx 1 / 111139 degrees
    const metersPerLatDegree = 111139;
    const latOffset = simulatedDistance / metersPerLatDegree;

    // Set simulator coordinates: Class Lat + offset, Class Lng
    setCoords(
      activeSession.latitude + latOffset,
      activeSession.longitude,
      1.5 // high precision 1.5 meter accuracy
    );
  }, [simulatedDistance, activeSession, isSimulated]);

  // Handle switching presets
  const handlePreset = (meters: number) => {
    setSimulatedDistance(meters);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900 text-white px-4 py-3 flex items-center justify-between text-xs font-semibold tracking-wider font-mono uppercase hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#12b19d]" />
          <span>ระบบจำลองพิกัดเพื่อความสะดวกการทดสอบ (Sim Zone)</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-850 px-2 py-0.5 rounded text-[10px]">
          {isOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isOpen ? "ซ่อนจำลอง" : "แสดงตัวจำลอง"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">โหมดการรับตำแหน่งพิกัด:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setSimulatedMode(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  isSimulated 
                    ? "bg-white text-[#12b19d] shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Simulator (จำลอง)
              </button>
              <button
                onClick={async () => {
                  setSimulatedMode(false);
                  await refreshLocation();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  !isSimulated 
                    ? "bg-white text-[#12b19d] shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Real GPS (พิกัดจริง)
              </button>
            </div>
          </div>

          {!isSimulated ? (
            <div className="bg-brand-50 border border-brand-100 text-[#0b7c6d] p-3 rounded-lg flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#12b19d] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">ใช้พิกัดจากอุปกรณ์จริง</p>
                <p className="text-[11px] text-[#0fa18e] mt-0.5 leading-relaxed">
                  ระบบกำลังอ่านพิกัดจากเซ็นเซอร์ GPS ของมือถือ/เบราว์เซอร์ของคุณ กรุณาอนุญาต Permission แผนที่หากเบราว์เซอร์แจ้งเตือนตำแหน่ง เพื่อให้เช็คชื่อสำเร็จ
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg space-y-1">
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
                  <span>พิกัดจำลองปัจจุบัน:</span>
                  <span className="text-slate-800 font-semibold">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </span>
                </div>
                {activeSession ? (
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
                    <span>ระยะถึงห้องเรียนจริง:</span>
                    <span className={`font-bold ${simulatedDistance <= 10 ? "text-emerald-600" : "text-amber-500"}`}>
                      {simulatedDistance.toFixed(1)} เมตร {simulatedDistance <= 10 ? "(เข้าเรียนได้)" : "(ไกลเกิน 10ม.)"}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    (สร้างห้องเรียนเพื่อจำลองระยะห่างได้ที่นี่)
                  </p>
                )}
              </div>

              {activeSession && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">ลากเพื่อเปลี่ยนระยะห่าง:</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {simulatedDistance} ม.
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="35"
                    step="0.5"
                    value={simulatedDistance}
                    onChange={(e) => setSimulatedDistance(parseFloat(e.target.value))}
                    className="w-full accent-[#12b19d] h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handlePreset(2)}
                      className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                        simulatedDistance === 2 
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" 
                          : "bg-white text-slate-750 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      ใกล้ (2 เมตร)
                    </button>
                    <button
                      onClick={() => handlePreset(9.5)}
                      className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                        simulatedDistance === 9.5 
                          ? "bg-amber-400 text-slate-900 border-amber-400 shadow-sm" 
                          : "bg-white text-slate-755 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      เกือบไกล (9.5 เมตร)
                    </button>
                    <button
                      onClick={() => handlePreset(18)}
                      className={`py-1.5 px-2 rounded font-medium border text-center transition ${
                        simulatedDistance === 18 
                          ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                          : "bg-white text-slate-755 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      ไกล (18 เมตร)
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-450 leading-relaxed">
                💡 <b>คำแนะนำ:</b> เลือกโหมด "Simulator" เพื่อทดสอบและตรวจรับงานได้ทันทีโดยไม่ต้องเดินเปลี่ยนพิกัดสถานที่จริงในห้องแล็บ
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
