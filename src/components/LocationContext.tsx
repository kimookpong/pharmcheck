import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

const BANGKOK_COORDS = { latitude: 13.7563, longitude: 100.5018 };

interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  isSimulated: boolean;
  loading: boolean;
  error: string | null;
  setCoords: (lat: number, lng: number, accuracy?: number) => void;
  setSimulatedMode: (simulated: boolean) => void;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationState | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  // Use Bangkok as initial default center
  const [coords, setLocalCoords] = useState<{ lat: number; lng: number }>({
    lat: BANGKOK_COORDS.latitude,
    lng: BANGKOK_COORDS.longitude
  });
  const [accuracy, setAccuracy] = useState<number | null>(3); // 3m default accuracy
  const [isSimulated, setIsSimulated] = useState<boolean>(false); // Default simulator OFF as requested by user
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Read config from localStorage if present
  useEffect(() => {
    const savedLat = localStorage.getItem("sim_latitude");
    const savedLng = localStorage.getItem("sim_longitude");

    if (savedLat && savedLng) {
      setLocalCoords({
        lat: parseFloat(savedLat),
        lng: parseFloat(savedLng)
      });
    }
    
    // Explicitly disable simulated mode on initial load by default
    setIsSimulated(false);
  }, []);

  // Set coordinate overrides manually
  const setCoords = (lat: number, lng: number, acc: number = 2) => {
    setLocalCoords({ lat, lng });
    setAccuracy(acc);
    localStorage.setItem("sim_latitude", String(lat));
    localStorage.setItem("sim_longitude", String(lng));
  };

  const setSimulatedMode = (simulated: boolean) => {
    setIsSimulated(simulated);
    localStorage.setItem("loc_simulated", String(simulated));
  };

  // Capture real GPS coordinates from device
  const refreshLocation = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("อุปกรณ์ของคุณไม่สนับสนุนระบบจับพิกัด GPS");
        resolve();
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          if (!isSimulated) {
            setLocalCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setAccuracy(position.coords.accuracy);
          }
          resolve();
        },
        (err) => {
          setLoading(false);
          let errMsg = "ไม่สามารถเชื่อมต่อ GPS ได้";
          if (err.code === err.PERMISSION_DENIED) {
            errMsg = "กรุณาเปิดสิทธิ์การเข้าถึงข้อมูลตำแหน่ง (Location Permission)";
          }
          setError(errMsg);
          console.warn("Geolocation watch error:", err);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  // Watch position in real-time when simulation is OFF
  useEffect(() => {
    if (isSimulated) return;

    if (!navigator.geolocation) {
      setError("อุปกรณ์ไม่รองรับการจับพิกัด GPS");
      return;
    }

    setLoading(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLoading(false);
        setLocalCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setAccuracy(position.coords.accuracy);
        setError(null);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("โปรดอนุญาตสิทธิ์ตรวจจับแผนที่ในเบราว์เซอร์");
        } else {
          setError("เกิดข้อผิดพลาดในการรับตำแหน่ง GPS");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulated]);

  return (
    <LocationContext.Provider
      value={{
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy,
        isSimulated,
        loading,
        error,
        setCoords,
        setSimulatedMode,
        refreshLocation
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
