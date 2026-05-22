import React from "react";
import { Attendance, Session } from "../types";

interface ClassroomRadarProps {
  session: Session;
  attendances: Attendance[];
}

export const ClassroomRadar: React.FC<ClassroomRadarProps> = ({ session, attendances }) => {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  
  // 10 meters will map to 80px radius in our 300px coordinate system
  const pixelsPerMeter = 90 / 10; // 10 meter boundary is 90px from center (180px diameter circle)

  // Fast string hash to map UIDs to stable, beautiful radial degrees so dots spread organically
  const getStableAngle = (uid: string): number => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 360) * (Math.PI / 180);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700/50">
      <div className="flex items-center justify-between w-full mb-3 px-2">
        <h4 className="text-sm font-semibold tracking-wide text-indigo-300 font-mono uppercase">
          Classroom Space Radar
        </h4>
        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-medium border border-emerald-500/30">
          ขอบเขต 10m
        </span>
      </div>

      <div className="relative w-full aspect-square max-w-[280px]">
        {/* Pulsing visual halo on the center */}
        <div 
          className="absolute rounded-full border border-emerald-500/30 bg-emerald-500/5 pointer-events-none"
          style={{
            width: "180px",
            height: "180px",
            left: "calc(50% - 90px)",
            top: "calc(50% - 90px)",
          }}
        />
        <div 
          className="absolute rounded-full border border-emerald-500/10 bg-emerald-500/5 radar-pulse-ring pointer-events-none"
          style={{
            width: "180px",
            height: "180px",
            left: "calc(50% - 90px)",
            top: "calc(50% - 90px)",
          }}
        />

        <svg 
          viewBox={`0 0 ${size} ${size}`} 
          className="w-full h-full drop-shadow-md select-none"
        >
          {/* Defs for glossy glow effects */}
          <defs>
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.15)" />
              <stop offset="60%" stopColor="rgba(16, 185, 129, 0.02)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
            </radialGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Radar background sector sweep color */}
          <circle cx={cx} cy={cy} r={cx - 10} fill="url(#radarGlow)" />

          {/* Grids / Rings */}
          {/* Inner zone 5m */}
          <circle cx={cx} cy={cy} r={45} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
          {/* Match / Limit Zone 10m */}
          <circle cx={cx} cy={cy} r={90} fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.8" />
          {/* Outer Warning zones */}
          <circle cx={cx} cy={cy} r={120} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="5,5" />
          <circle cx={cx} cy={cy} r={140} fill="none" stroke="#1e293b" strokeWidth="1" />

          {/* Crosshair guidelines */}
          <line x1="10" y1={cy} x2={size - 10} y2={cy} stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />
          <line x1={cx} y1="10" x2={cx} y2={size - 10} stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />

          {/* Distance Text notches */}
          <text x={cx + 48} y={cy - 4} fill="#64748b" fontSize="8" fontFamily="monospace">5m</text>
          <text x={cx + 94} y={cy - 4} fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="bold">10m</text>
          <text x={cx + 124} y={cy - 4} fill="#64748b" fontSize="8" fontFamily="monospace">15m</text>

          {/* Center Point - Classroom/Teacher Tower */}
          <g transform={`translate(${cx - 8}, ${cy - 8})`} filter="url(#glow)">
            <circle cx="8" cy="8" r="8" fill="#6366f1" />
            <circle cx="8" cy="8" r="4" fill="#ffffff" />
          </g>
          
          {/* Render Attendees dynamically plotted based on their actual check-in distance */}
          {attendances.map((student) => {
            const angle = getStableAngle(student.studentUid);
            // Limit coordinate mapping up to 16 meters visuals so they don't print outside the SVG boundary
            const clampedDistance = Math.min(student.distance, 16);
            const visualDist = clampedDistance * pixelsPerMeter;
            
            const px = cx + visualDist * Math.cos(angle);
            const py = cy + visualDist * Math.sin(angle);

            const isInside = student.distance <= 10;
            const dotColor = isInside ? "#10b981" : "#f59e0b";
            const textColor = isInside ? "#34d399" : "#fbbf24";

            return (
              <g key={student.id} className="transition-all duration-300 ease-out cursor-pointer group">
                {/* Dynamic pulse halo that scales or glows based on range */}
                <circle 
                  cx={px} 
                  cy={py} 
                  r={isInside ? "9" : "6"} 
                  fill={dotColor} 
                  fillOpacity="0.25" 
                  className={isInside ? "animate-pulse" : ""}
                />
                <circle 
                  cx={px} 
                  cy={py} 
                  r={isInside ? "16" : "11"} 
                  fill="none" 
                  stroke={dotColor} 
                  strokeWidth="0.75" 
                  strokeOpacity="0.3" 
                  strokeDasharray={isInside ? "none" : "2,2"}
                  className={isInside ? "animate-ping" : ""}
                  style={{ transformOrigin: `${px}px ${py}px`, animationDuration: '2s' }}
                />
                
                {/* Core student positioning circle */}
                <circle 
                  cx={px} 
                  cy={py} 
                  r="5" 
                  fill={dotColor} 
                  stroke="#ffffff" 
                  strokeWidth="1.5" 
                  className="filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                />

                {/* Highly scannable student name text above dot */}
                <text 
                  x={px} 
                  y={py - 10} 
                  fill={textColor} 
                  fontSize="7.5" 
                  fontFamily="sans-serif"
                  fontWeight="black"
                  textAnchor="middle"
                  className="select-none font-bold filter drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]"
                >
                  {student.studentName.split(" ")[0].slice(0, 7)}
                </text>

                {/* Dynamic distance metric specifically shown in real-time below dot */}
                <text 
                  x={px} 
                  y={py + 12} 
                  fill="#ffffff" 
                  fontSize="7" 
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none font-bold filter drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]"
                >
                  {student.distance.toFixed(1)}m
                </text>
              </g>
            );
          })}
        </svg>

        {/* Center overlay labels */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-10 text-[9px] font-semibold text-indigo-200 uppercase tracking-widest font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded-full shadow pointer-events-none border border-indigo-500/30">
          ห้องเรียน
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 border border-indigo-300" />
          <span>จุดพิกัดอาจารย์</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300" />
          <span>เข้ามาเรียน (≤10ม.)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-300" />
          <span>นอกระยะ (&gt;10ม.)</span>
        </div>
      </div>

      {/* Live Proximity Metric Table for absolute real-time verification */}
      <div className="w-full mt-4 pt-4 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-extrabold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            พารามิเตอร์ระยะเรดาร์ Dynamic
          </span>
          <span className="text-[10px] bg-slate-850 text-emerald-450 border border-slate-700/80 px-2 py-0.5 rounded-full font-mono font-bold">
            Live: {attendances.length} บัญชี
          </span>
        </div>
        
        {attendances.length === 0 ? (
          <p className="text-center text-[10px] font-medium text-slate-500 py-3 italic font-sans">
            รอนักศึกษาส่งพิกัดสัญญาณพิกัด GPS สด...
          </p>
        ) : (
          <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 text-slate-300">
            {attendances
              .sort((a, b) => a.distance - b.distance)
              .map((student) => {
                const isInside = student.distance <= 10;
                return (
                  <div 
                    key={student.id} 
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all duration-300 ${
                      isInside 
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-100" 
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isInside ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`} />
                      <div className="flex flex-col text-left truncate">
                        <span className="font-extrabold truncate text-[11px] text-slate-200">
                          {student.studentName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">
                          {student.studentId}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className={`font-mono font-black text-[12px] ${
                        isInside ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {student.distance.toFixed(1)} เมตร
                      </span>
                      <span className={`block text-[8px] font-black uppercase ${
                        isInside ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {isInside ? "✓ พร้อมเช็ค" : "✦ ไกลเกินระยะ"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
