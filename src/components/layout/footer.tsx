export function Footer() {
  return (
    <footer className="py-4 px-8 bg-[#001437]">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2.5">
          <img src="/pro_web_consulting_logo.png" alt="Pro Web" className="h-5 w-auto opacity-60" />
          <div className="leading-tight">
            <span className="text-[11px] font-medium text-white/40">Pro Web Digital Consulting</span>
            <span className="text-white/20 mx-1.5">&middot;</span>
            <span className="text-[10px] text-white/30">Cerved Group S.p.A.</span>
          </div>
        </div>
        <p className="text-[10px] text-white/20">&copy; {new Date().getFullYear()} Tutti i diritti riservati</p>
      </div>
    </footer>
  );
}
