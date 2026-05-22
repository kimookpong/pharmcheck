import React from "react";

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
      {/* Dynamic Overlapping Brand Shape SVG */}
      <svg
        className={`${currSize.logoSize} filter drop-shadow-sm`}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Blue/Cyan pill */}
        <path
          d="M16 16C16 11.5817 19.5817 8 24 8H40C44.4183 8 48 11.5817 48 16V24C48 28.4183 44.4183 32 40 32H24C19.5817 32 16 28.4183 16 24V16Z"
          fill="url(#blueGrad)"
          opacity="0.9"
        />
        {/* Orange/Red cross-link */}
        <rect
          x="20"
          y="20"
          width="24"
          height="24"
          rx="12"
          fill="url(#orangeGrad)"
          mix-blend-mode="multiply"
        />
        {/* Intersecting elements */}
        <circle cx="28" cy="28" r="8" fill="#12b19d" opacity="0.85" />
        <circle cx="36" cy="36" r="8" fill="#3b82f6" opacity="0.85" />
        <circle cx="36" cy="28" r="6" fill="#ef4444" opacity="0.85" />
        <circle cx="28" cy="36" r="6" fill="#f97316" opacity="0.85" />

        {/* Gradients definitions for crisp visuals */}
        <defs>
          <linearGradient id="blueGrad" x1="16" y1="8" x2="48" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="orangeGrad" x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>

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
