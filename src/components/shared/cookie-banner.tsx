'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Shield, ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'undrift-cookie-consent';

export type ConsentValue = 'all' | 'necessary' | string; // string for JSON like {"analytics":true}

/** Read current consent from localStorage (returns null if not set). */
export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Check if analytics (Umami) is allowed based on stored consent. */
export function isAnalyticsAllowed(): boolean {
  const consent = getConsent();
  if (!consent) return false;
  if (consent === 'all') return true;
  if (consent === 'necessary') return false;
  try {
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

/** Dispatch a custom event so AnalyticsLoader can react immediately. */
function dispatchConsentEvent() {
  window.dispatchEvent(new CustomEvent('cookie-consent-change'));
}

/** Programmatically re-open the banner (used from Settings / footer link). */
export function reopenCookieBanner() {
  window.dispatchEvent(new CustomEvent('cookie-banner-reopen'));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsToggle, setAnalyticsToggle] = useState(false);

  // Show banner if no consent stored
  useEffect(() => {
    if (!getConsent()) {
      setVisible(true);
    }
  }, []);

  // Listen for reopen requests
  useEffect(() => {
    function handleReopen() {
      setClosing(false);
      setShowCustomize(false);
      setVisible(true);
    }
    window.addEventListener('cookie-banner-reopen', handleReopen);
    return () => window.removeEventListener('cookie-banner-reopen', handleReopen);
  }, []);

  const saveAndClose = useCallback((value: ConsentValue) => {
    localStorage.setItem(STORAGE_KEY, value);
    dispatchConsentEvent();
    setClosing(true);
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleAcceptAll = () => saveAndClose('all');
  const handleNecessaryOnly = () => saveAndClose('necessary');
  const handleSaveCustom = () => {
    if (analyticsToggle) {
      saveAndClose(JSON.stringify({ analytics: true }));
    } else {
      saveAndClose('necessary');
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ease-out ${
        closing ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md border-t border-[rgba(0,20,55,0.08)] shadow-[0_-4px_24px_rgba(0,20,55,0.08)]">
        <div className="max-w-5xl mx-auto px-4 py-4 md:px-8">
          {/* Main row */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2.5 mb-1">
                <Shield className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                <p className="text-[13px] leading-relaxed text-foreground/80">
                  Usiamo cookie tecnici per il funzionamento del servizio e{' '}
                  <strong className="font-medium text-foreground">Umami Analytics</strong>{' '}
                  (privacy-first, senza cookie di profilazione) per capire come migliorare Undrift.{' '}
                  <Link
                    href="/privacy"
                    className="text-accent hover:underline font-medium"
                  >
                    Leggi la privacy policy
                  </Link>
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                onClick={() => setShowCustomize((v) => !v)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-foreground/60 hover:bg-muted transition-colors"
              >
                Personalizza
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showCustomize ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                onClick={handleNecessaryOnly}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border border-border text-foreground/70 hover:bg-muted transition-colors"
              >
                Solo necessari
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-accent-light transition-colors"
              >
                Accetta tutti
              </button>
            </div>
          </div>

          {/* Customize panel */}
          {showCustomize && (
            <div className="mt-4 pt-4 border-t border-border animate-slide-down">
              <div className="space-y-3">
                {/* Technical cookies - always on */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Cookie tecnici</p>
                    <p className="text-[11px] text-muted-foreground">
                      Necessari per autenticazione e funzionamento del servizio
                    </p>
                  </div>
                  <div className="relative">
                    <div className="w-10 h-[22px] rounded-full bg-accent/30 cursor-not-allowed">
                      <div className="absolute top-[3px] left-[21px] w-4 h-4 rounded-full bg-accent" />
                    </div>
                    <span className="block text-[10px] text-muted-foreground text-center mt-0.5">
                      Sempre attivi
                    </span>
                  </div>
                </div>

                {/* Analytics toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Analytics (Umami)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Statistiche anonime per migliorare il servizio
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={analyticsToggle}
                    onClick={() => setAnalyticsToggle((v) => !v)}
                    className={`relative w-10 h-[22px] rounded-full transition-colors ${
                      analyticsToggle ? 'bg-accent' : 'bg-foreground/20'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        analyticsToggle ? 'left-[21px]' : 'left-[3px]'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSaveCustom}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-accent-light transition-colors"
                >
                  Salva preferenze
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
