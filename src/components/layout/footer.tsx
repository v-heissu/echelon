export function Footer() {
  return (
    <footer className="py-5 px-8 border-t border-slate-200/60">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2.5">
          {/* Pro Web logo — will be replaced with uploaded image */}
          <img src="/pwc-logo.png" alt="Pro Web Digital Consulting" className="h-6 w-auto" />
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
