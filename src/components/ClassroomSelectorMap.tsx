import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, Navigation, Compass, Loader2 } from "lucide-react";

interface ClassroomSelectorMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  onFetchGps: () => Promise<void>;
  locLoading: boolean;
}

export const ClassroomSelectorMap: React.FC<ClassroomSelectorMapProps> = ({
  latitude,
  longitude,
  onChange,
  onFetchGps,
  locLoading,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    // Beautiful CartoDB Voyager tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map);

    mapRef.current = map;

    // Custom draggable orange pin
    const pinIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-lg border-2 border-white ring-4 ring-orange-500/20 active:scale-95 transition-transform duration-100 cursor-grab">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([latitude, longitude], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;

    // 10-meter boundary radius around the classroom coordinates
    const radiusCircle = L.circle([latitude, longitude], {
      radius: 10,
      color: "#f97316",
      fillColor: "#f97316",
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: "3, 5",
    }).addTo(map);

    radiusCircleRef.current = radiusCircle;

    // Capture Drag Position
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      onChange(position.lat, position.lng);
    });

    // Fit map size
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      radiusCircleRef.current = null;
    };
  }, []);

  // Update position on external coordinates change (e.g. from telemetry or fetch)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const radiusCircle = radiusCircleRef.current;

    if (map && marker && radiusCircle) {
      const newLatLng = L.latLng(latitude, longitude);
      
      // Update marker position if not currently dragging
      marker.setLatLng(newLatLng);
      radiusCircle.setLatLng(newLatLng);
      
      // Smooth fly to new coordinate
      map.setView(newLatLng, map.getZoom(), { animate: true });
    }
  }, [latitude, longitude]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
          <MapPin className="w-3.5 h-3.5 text-orange-500" />
          <span>แผนที่กำหนดพิกัดเรียน</span>
        </span>
        <button
          type="button"
          onClick={onFetchGps}
          disabled={locLoading}
          className="text-[10px] bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 hover:text-orange-700 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition duration-155 active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {locLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
          ) : (
            <Navigation className="w-3 h-3 text-orange-500 fill-orange-500" />
          )}
          <span>{locLoading ? "กำลังค้นหา..." : "ดึงพิกัด GPS จริง"}</span>
        </button>
      </div>

      {/* Leaflet Map Block */}
      <div className="relative border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-slate-50">
        <div 
          ref={mapContainerRef} 
          className="h-[180px] w-full z-10" 
        />

        {/* Informative Map Badge */}
        <div className="absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1 bg-white/95 backdrop-blur border border-slate-250/65 rounded-lg text-[8.5px] font-sans font-bold text-slate-600 shadow-sm pointer-events-none flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span>ลากพินสีส้มเพื่อเลื่อนห้องเรียน (รัศมี 10 ม.)</span>
        </div>
      </div>

      {/* Inputs Coordinates Display */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-150">
          <span className="block text-[8.5px] text-slate-400 font-mono uppercase tracking-wider">Latitude</span>
          <span className="text-[11px] font-mono font-bold text-slate-700">{latitude.toFixed(6)}</span>
        </div>
        <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-150">
          <span className="block text-[8.5px] text-slate-400 font-mono uppercase tracking-wider">Longitude</span>
          <span className="text-[11px] font-mono font-bold text-slate-700">{longitude.toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
};
