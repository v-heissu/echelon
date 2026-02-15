export function Footer() {
  return (
    <footer className="py-5 px-8 border-t border-slate-200/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Pro Web logo mark */}
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="pw-grad" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0ea5e9" />
                <stop offset="1" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            <path
              d="M16 2C16 2 6 14 6 20a10 10 0 0 0 20 0C26 14 16 2 16 2Z"
              fill="url(#pw-grad)"
              opacity="0.85"
            />
            <path
              d="M16 8c0 0-5 6.5-5 10a5 5 0 0 0 10 0c0-3.5-5-10-5-10Z"
              fill="white"
              opacity="0.3"
            />
          </svg>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-slate-400">
              Pro Web Digital Consulting
            </p>
            <p className="text-[10px] text-slate-300 font-medium">
              Cerved Group S.p.A.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-300 font-medium">
          &copy; 2026 Tutti i diritti riservati
        </p>
      </div>
    </footer>
  );
}
