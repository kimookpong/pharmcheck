import React from "react";
import logoImg from "../assets/logo.png";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", size = "md" }) => {
  const sizeClasses = {
    sm: {
      gap: "gap-1.5",
      logoSize: "h-6 w-6",
      textSize: "text-sm",
      subTextSize: "text-[10px]",
    },
    md: {
      gap: "gap-2",
      logoSize: "h-9 w-9",
      textSize: "text-lg",
      subTextSize: "text-xs",
    },
    lg: {
      gap: "gap-3",
      logoSize: "h-14 w-14",
      textSize: "text-2xl",
      subTextSize: "text-sm",
    },
  };

  const currSize = sizeClasses[size];

  return (
    <div className={`flex items-center ${currSize.gap} ${className}`}>
      {/* Brand Logo Image */}
      <img
        src={logoImg}
        alt="PharmCheck Logo"
        className={`${currSize.logoSize} object-contain`}
      />

      {/* Brand typographic branding */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline">
          <span className={`font-extrabold ${currSize.textSize} text-slate-900 tracking-tight font-sans`}>
            Pharm
          </span>
          <span className={`font-black ${currSize.textSize} text-[#12b19d] tracking-tight ml-0.5 font-sans`}>
            Check
          </span>
        </div>
        <span className={`${currSize.subTextSize} text-slate-400 font-bold tracking-widest uppercase font-mono mt-0.5`}>
          ATTENDANCE
        </span>
      </div>
    </div>
  );
};


