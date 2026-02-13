'use client';

export function EchelonLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mountain */}
      <path
        d="M6 38L18 14L24 24L30 14L42 38H6Z"
        fill="url(#mountain-gradient)"
        stroke="white"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />
      {/* Peak highlight */}
      <path
        d="M18 14L22 22L14 22L18 14Z"
        fill="url(#peak-gradient)"
        opacity="0.6"
      />
      <path
        d="M30 14L34 22L26 22L30 14Z"
        fill="url(#peak-gradient)"
        opacity="0.6"
      />
      {/* Antenna */}
      <line x1="24" y1="8" x2="24" y2="24" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Signal waves */}
      <path
        d="M19 10C19 10 21 8 24 8C27 8 29 10 29 10"
        stroke="url(#signal-gradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M16 12C16 12 19 8 24 8C29 8 32 12 32 12"
        stroke="url(#signal-gradient)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Antenna dot */}
      <circle cx="24" cy="7" r="2" fill="url(#signal-gradient)" />
      <defs>
        <linearGradient id="mountain-gradient" x1="6" y1="38" x2="42" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#007AC5" />
          <stop offset="1" stopColor="#00A4E6" />
        </linearGradient>
        <linearGradient id="peak-gradient" x1="14" y1="14" x2="34" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A4E6" />
          <stop offset="1" stopColor="#33A1AB" />
        </linearGradient>
        <linearGradient id="signal-gradient" x1="16" y1="12" x2="32" y2="7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A4E6" />
          <stop offset="1" stopColor="#FFC76D" />
        </linearGradient>
      </defs>
    </svg>
  );
}
