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
      <defs>
        <linearGradient id="ech-mountain" x1="4" y1="40" x2="44" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0062A0" />
          <stop offset="0.5" stopColor="#007AC5" />
          <stop offset="1" stopColor="#00A4E6" />
        </linearGradient>
        <linearGradient id="ech-peak" x1="18" y1="12" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00C2FF" />
          <stop offset="1" stopColor="#007AC5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ech-signal" x1="15" y1="6" x2="33" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A4E6" />
          <stop offset="1" stopColor="#FFC76D" />
        </linearGradient>
        <linearGradient id="ech-glow" x1="24" y1="4" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC76D" />
          <stop offset="1" stopColor="#00A4E6" />
        </linearGradient>
        <filter id="ech-shadow" x="-2" y="-2" width="52" height="52">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#007AC5" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Mountain body */}
      <path
        d="M4 40L17 15L24 26L31 15L44 40H4Z"
        fill="url(#ech-mountain)"
        filter="url(#ech-shadow)"
      />
      {/* Snow/highlight on peaks */}
      <path
        d="M17 15L20.5 22L13.5 22L17 15Z"
        fill="url(#ech-peak)"
        opacity="0.7"
      />
      <path
        d="M31 15L34.5 22L27.5 22L31 15Z"
        fill="url(#ech-peak)"
        opacity="0.7"
      />
      {/* Valley shadow */}
      <path
        d="M20 28L24 26L28 28L32 40H16L20 28Z"
        fill="#001437"
        opacity="0.15"
      />

      {/* Antenna mast */}
      <line x1="24" y1="6" x2="24" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />

      {/* Signal arcs */}
      <path
        d="M20 9.5C20 9.5 21.5 7.5 24 7.5C26.5 7.5 28 9.5 28 9.5"
        stroke="url(#ech-signal)"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M17 12C17 12 19.5 8.5 24 8.5C28.5 8.5 31 12 31 12"
        stroke="url(#ech-signal)"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M14.5 14C14.5 14 18 9 24 9C30 9 33.5 14 33.5 14"
        stroke="url(#ech-signal)"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />

      {/* Antenna tip glow */}
      <circle cx="24" cy="5.5" r="2.5" fill="url(#ech-glow)" opacity="0.9" />
      <circle cx="24" cy="5.5" r="1.2" fill="white" opacity="0.95" />
    </svg>
  );
}
