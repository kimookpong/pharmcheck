import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Session, Attendance } from "../types";
import { MapPin, Compass, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface AttendanceMapProps {
  session: Session | null;
  attendances?: Attendance[];
  studentCoords?: { latitude: number; longitude: number } | null;
  accuracy?: number | null;
  heightClass?: string;
  isStudentView?: boolean;
}

export const AttendanceMap: React.FC<AttendanceMapProps> = ({
  session,
  attendances = [],
  studentCoords = null,
  accuracy = null,
  heightClass = "h-[320px]",
  isStudentView = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Keep track of layers to clean them up dynamically on state updates
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const boundaryCircleRef = useRef<L.Circle | null>(null);
  const studentAccuracyCircleRef = useRef<L.Circle | null>(null);
  const distanceLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center coords (near class or Thailand universities default center if none)
    const initialLat = session ? session.latitude : (studentCoords ? studentCoords.latitude : 13.7563);
    const initialLng = session ? session.longitude : (studentCoords ? studentCoords.longitude : 100.5018);

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 19,
      zoomControl: false, // Disabling default to create a clean custom bottom/top control design
      attributionControl: true,
    });

    // Add CartoDB Voyager Tile layer (soft, beautiful, and highly polished)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 22,
    }).addTo(map);

    mapRef.current = map;

    // Create a LayerGroup for markers
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Initial scale fix (Leaflet sometimes miscalulates container size on instant render)
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map contents whenever props change
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear previous layers
    markersGroup.clearLayers();
    if (boundaryCircleRef.current) {
      boundaryCircleRef.current.remove();
      boundaryCircleRef.current = null;
    }
    if (studentAccuracyCircleRef.current) {
      studentAccuracyCircleRef.current.remove();
      studentAccuracyCircleRef.current = null;
    }
    if (distanceLineRef.current) {
      distanceLineRef.current.remove();
      distanceLineRef.current = null;
    }

    const bounds: L.LatLngExpression[] = [];

    // Custom inline HTML styled icons to prevent Vite asset path issues
    const teacherIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white shadow-lg border-2 border-white ring-4 ring-indigo-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
          </svg>
        </div>
      `,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const studentSelfIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white shadow-lg border-2 border-white ring-4 ring-indigo-500/30 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const presentAttendeeIcon = (initials: string) => L.divIcon({
      html: `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-550 text-white shadow-md border-2 border-white font-mono text-[9px] font-bold">
          ${initials}
        </div>
      `,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const farAttendeeIcon = (initials: string) => L.divIcon({
      html: `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white shadow-md border-2 border-white font-mono text-[9px] font-bold">
          ${initials}
        </div>
      `,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    // 1. Plot Classroom Session Center point
    if (session && typeof session.latitude === "number" && typeof session.longitude === "number" && !isNaN(session.latitude) && !isNaN(session.longitude)) {
      const classLatLng = L.latLng(session.latitude, session.longitude);
      bounds.push(classLatLng);

      const teacherMarker = L.marker(classLatLng, { icon: teacherIcon })
        .bindPopup(`
          <div class="p-1 font-sans">
            <h5 class="font-bold text-slate-800 text-xs">${session.subjectName}</h5>
            <p class="text-[10px] text-slate-500 mt-0.5">พิกัดห้องเรียนหลัก (Center)</p>
            <p class="text-[9px] font-mono text-indigo-600 mt-1">${session.latitude.toFixed(6)}, ${session.longitude.toFixed(6)}</p>
          </div>
        `);
      markersGroup.addLayer(teacherMarker);

      // Draw acceptable check-in limit perimeter circle (10 meters)
      const perimeterCircle = L.circle(classLatLng, {
        radius: 10,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: "3, 5",
      }).addTo(map);
      boundaryCircleRef.current = perimeterCircle;
    }

    // 2. Plot Student Coords (Self Location)
    if (studentCoords && typeof studentCoords.latitude === "number" && typeof studentCoords.longitude === "number" && !isNaN(studentCoords.latitude) && !isNaN(studentCoords.longitude)) {
      const studentLatLng = L.latLng(studentCoords.latitude, studentCoords.longitude);
      bounds.push(studentLatLng);

      const studentMarker = L.marker(studentLatLng, { icon: studentSelfIcon })
        .bindPopup(`
          <div class="p-1 font-sans">
            <h5 class="font-bold text-emerald-600 text-xs">คุณอยู่ที่นี่</h5>
            <p class="text-[10px] text-slate-500 mt-0.5">จำลองพิกัดรับสัญญาณ GPS</p>
            <p class="text-[9px] font-mono text-slate-600 mt-1">${studentCoords.latitude.toFixed(6)}, ${studentCoords.longitude.toFixed(6)}</p>
          </div>
        `);
      markersGroup.addLayer(studentMarker);

      if (typeof accuracy === "number" && !isNaN(accuracy) && accuracy > 0) {
        // Draw accuracy range ring
        const accCircle = L.circle(studentLatLng, {
          radius: accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.05,
          weight: 1,
        }).addTo(map);
        studentAccuracyCircleRef.current = accCircle;
      }

      // If active session exists, draw a dotted connecting guideline to class center
      if (session && typeof session.latitude === "number" && typeof session.longitude === "number" && !isNaN(session.latitude) && !isNaN(session.longitude)) {
        const classLatLng = L.latLng(session.latitude, session.longitude);
        const distanceLine = L.polyline([studentLatLng, classLatLng], {
          color: "#6366f1",
          weight: 2,
          dashArray: "5, 5",
          opacity: 0.75,
        }).addTo(map);
        distanceLineRef.current = distanceLine;
      }
    }

    // 3. For Teachers Dashboard: Plot other student check-ins on the map if coordinates exist
    if (!isStudentView && attendances && attendances.length > 0) {
      attendances.forEach((student) => {
        if (student.coords && typeof student.coords.latitude === "number" && typeof student.coords.longitude === "number" && !isNaN(student.coords.latitude) && !isNaN(student.coords.longitude)) {
          const sLatLng = L.latLng(student.coords.latitude, student.coords.longitude);
          bounds.push(sLatLng);

          // Get Initials or short handle
          const parts = student.studentName.split(" ");
          const namePart = parts[1] || parts[0];
          const initials = namePart.slice(0, 2).toUpperCase();

          const isInside = student.distance <= 10;
          const sMarker = L.marker(sLatLng, {
            icon: isInside ? presentAttendeeIcon(initials) : farAttendeeIcon(initials)
          }).bindPopup(`
            <div class="p-1.5 font-sans min-w-[140px]">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${isInside ? "bg-emerald-500" : "bg-amber-500"}"></span>
                <span class="font-bold text-slate-800 text-xs">${student.studentName}</span>
              </div>
              <p class="text-[10px] text-slate-500 mt-0.5">รหัส: ${student.studentId}</p>
              <div class="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between text-[9px] font-mono text-slate-500">
                <span>ระยะห่าง:</span>
                <span class="font-bold text-slate-800">${student.distance.toFixed(1)} เมตร</span>
              </div>
              <div class="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                <span>เวลาเช็คชื่อ:</span>
                <span class="font-bold text-indigo-650">${new Date(student.timestamp).toLocaleTimeString("th-TH")} น.</span>
              </div>
            </div>
          `);
          markersGroup.addLayer(sMarker);
        }
      });
    }

    // Smart pan/zoom layout to comfortably fit all active coordinates inside current viewpoint
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 19);
      } else {
        const latLngBounds = L.latLngBounds(bounds);
        map.fitBounds(latLngBounds.pad(0.35), { animate: true });
      }
    }
  }, [session, attendances, studentCoords, accuracy, isStudentView]);

  // Utility actions for zooming or resetting
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    
    if (session) {
      map.setView([session.latitude, session.longitude], 19);
    } else if (studentCoords) {
      map.setView([studentCoords.latitude, studentCoords.longitude], 19);
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="relative border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-slate-100">
      
      {/* Map Element Container */}
      <div 
        ref={mapContainerRef} 
        className={`${heightClass} w-full transition-all duration-300 z-10`}
      />

      {/* Modern map controls overlay */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 bg-white/95 backdrop-blur border border-slate-200 text-slate-700 hover:text-slate-900 shadow-md rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white/95 backdrop-blur border border-slate-200 text-slate-700 hover:text-slate-900 shadow-md rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="w-8 h-8 bg-white/95 backdrop-blur border border-slate-200 text-indigo-600 hover:text-indigo-800 shadow-md rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="Recenter Map"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Map visual legend badge */}
      <div className="absolute bottom-3 left-3 z-20 px-3 py-1.5 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 flex items-center gap-2 text-[9px] font-mono text-slate-200 shadow-lg pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-indigo-500 outline outline-2 outline-white/25"></span>
        <span>ห้องเรียน</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>ผ่าน (≤10ม.)</span>
      </div>
    </div>
  );
};
