'use client';

export function EchelonLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Background gradient - deep navy */}
        <linearGradient id="ech-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0a1628" />
          <stop offset="0.5" stopColor="#0d1f3c" />
          <stop offset="1" stopColor="#081222" />
        </linearGradient>
        {/* Mountain ridge gradient */}
        <linearGradient id="ech-ridge" x1="10" y1="80" x2="50" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0a1a35" />
          <stop offset="0.4" stopColor="#122a52" />
          <stop offset="1" stopColor="#1a3a6a" />
        </linearGradient>
        {/* Mountain foreground */}
        <linearGradient id="ech-fg" x1="20" y1="90" x2="80" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0d1e3a" />
          <stop offset="1" stopColor="#15325c" />
        </linearGradient>
        {/* Signal ring gradient */}
        <radialGradient id="ech-signal" cx="50" cy="30" r="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4dc9f6" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#2a8fc9" stopOpacity="0.4" />
          <stop offset="1" stopColor="#1a5c8a" stopOpacity="0" />
        </radialGradient>
        {/* Antenna glow */}
        <radialGradient id="ech-glow" cx="50" cy="28" r="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#80e0ff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#4dc9f6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Squircle background */}
      <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#ech-bg)" />

      {/* Stars */}
      <circle cx="18" cy="18" r="0.7" fill="white" opacity="0.5" />
      <circle cx="78" cy="14" r="0.5" fill="white" opacity="0.4" />
      <circle cx="85" cy="28" r="0.6" fill="white" opacity="0.35" />
      <circle cx="25" cy="35" r="0.5" fill="white" opacity="0.3" />
      <circle cx="12" cy="42" r="0.4" fill="white" opacity="0.25" />
      <circle cx="88" cy="42" r="0.5" fill="white" opacity="0.3" />
      <circle cx="35" cy="12" r="0.5" fill="white" opacity="0.45" />
      <circle cx="65" cy="20" r="0.4" fill="white" opacity="0.35" />
      <circle cx="42" cy="22" r="0.6" fill="white" opacity="0.3" />
      <circle cx="72" cy="38" r="0.4" fill="white" opacity="0.2" />

      {/* Concentric signal rings */}
      <circle cx="50" cy="30" r="10" stroke="#4dc9f6" strokeWidth="0.8" fill="none" opacity="0.5" />
      <circle cx="50" cy="30" r="17" stroke="#3ab0e0" strokeWidth="0.7" fill="none" opacity="0.35" />
      <circle cx="50" cy="30" r="24" stroke="#2a90c0" strokeWidth="0.6" fill="none" opacity="0.22" />
      <circle cx="50" cy="30" r="31" stroke="#1a70a0" strokeWidth="0.5" fill="none" opacity="0.12" />

      {/* Background mountain range - distant */}
      <path
        d="M0 78L15 60L25 68L38 50L50 62L62 48L75 58L85 52L100 65L100 100L0 100Z"
        fill="url(#ech-ridge)"
        opacity="0.6"
      />

      {/* Main mountain - prominent central peak with ridge line */}
      <path
        d="M0 90L18 72L30 78L42 58L50 42L58 58L70 78L82 72L100 90L100 100L0 100Z"
        fill="url(#ech-fg)"
      />

      {/* Ridge highlight - snow/light edge on peak */}
      <path
        d="M42 58L50 42L58 58"
        stroke="#2a5a90"
        strokeWidth="0.8"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M30 78L42 58L50 42"
        stroke="#1e4470"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />

      {/* Antenna mast */}
      <line x1="50" y1="28" x2="50" y2="42" stroke="#80c8e8" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

      {/* Antenna glow effect */}
      <circle cx="50" cy="28" r="6" fill="url(#ech-glow)" />

      {/* Antenna tip bright dot */}
      <circle cx="50" cy="28" r="2" fill="#b0e8ff" opacity="0.9" />
      <circle cx="50" cy="28" r="1" fill="white" opacity="0.95" />
    </svg>
  );
}
