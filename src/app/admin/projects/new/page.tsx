'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  Globe,
  Calendar,
  Search,
  Building2,
  Check,
} from 'lucide-react';

type Step = 'basics' | 'ai-fill' | 'review';

interface AutofillResult {
  industry: string;
  keywords: string[];
  competitors: string[];
  language: string;
  location_code: number;
  sources: string[];
  schedule: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>(['google_organic', 'google_news']);
  const [schedule, setSchedule] = useState('manual');
  const [scheduleDay, setScheduleDay] = useState(1);
  const [language, setLanguage] = useState('it');
  const [locationCode, setLocationCode] = useState(2380);

  // Input refs for adding items
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const competitorInputRef = useRef<HTMLInputElement>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');

  const addKeyword = useCallback(() => {
    const val = newKeyword.trim();
    if (val && !keywords.includes(val) && keywords.length < 10) {
      setKeywords((prev) => [...prev, val]);
      setNewKeyword('');
      keywordInputRef.current?.focus();
    }
  }, [newKeyword, keywords]);

  const addCompetitor = useCallback(() => {
    const parts = newCompetitor.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setCompetitors((prev) => {
      const unique = parts.filter((p) => !prev.includes(p));
      return [...prev, ...unique].slice(0, 20);
    });
    setNewCompetitor('');
    competitorInputRef.current?.focus();
  }, [newCompetitor, competitors]);

  async function handleAiFill() {
    if (!name.trim()) return;
    setAiLoading(true);
    setAiDone(false);

    try {
      const res = await fetch('/api/admin/projects/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });

      if (!res.ok) {
        throw new Error('Autofill failed');
      }

      const data: AutofillResult = await res.json();

      setIndustry(data.industry || '');
      setKeywords(data.keywords?.slice(0, 10) || []);
      setCompetitors(data.competitors?.slice(0, 20) || []);
      setLanguage(data.language || 'it');
      setLocationCode(data.location_code || 2380);
      setSources(data.sources || ['google_organic', 'google_news']);
      setSchedule(data.schedule || 'weekly');

      setAiDone(true);
      // Transition to review after a brief moment
      setTimeout(() => setStep('review'), 600);
    } catch {
      alert('Errore nella generazione AI. Riprova.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          industry,
          keywords,
          competitors,
          sources,
          schedule,
          schedule_day: scheduleDay,
          language,
          location_code: locationCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert('Errore: ' + data.error);
        return;
      }

      const project = await res.json();

      // Automatically trigger first scan if keywords are configured
      if (keywords.length > 0) {
        try {
          const scanRes = await fetch('/api/scans/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_slug: project.slug }),
          });
          if (!scanRes.ok) {
            console.error('Scan trigger failed:', await scanRes.json());
          }
        } catch {
          console.error('Scan trigger network error');
        }
      }

      router.push(`/project/${project.slug}`);
    } catch {
      alert('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSource(source: string) {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  // --- Step indicator ---
  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'basics', label: 'Progetto', icon: <Building2 className="w-4 h-4" /> },
    { key: 'ai-fill', label: 'AI Autofill', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'review', label: 'Configura', icon: <Check className="w-4 h-4" /> },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Nuovo Progetto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura il monitoraggio con l&apos;aiuto dell&apos;intelligenza artificiale
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (s.key === 'basics') setStep('basics');
                if (s.key === 'review' && aiDone) setStep('review');
              }}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300
                ${stepIndex === i
                  ? 'bg-accent text-white shadow-md'
                  : stepIndex > i
                    ? 'bg-accent/10 text-accent cursor-pointer hover:bg-accent/20'
                    : 'bg-muted text-muted-foreground'
                }
              `}
            >
              {s.icon}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 rounded transition-colors duration-300 ${stepIndex > i ? 'bg-accent' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ============================================ */}
      {/* STEP 1: Basics */}
      {/* ============================================ */}
      {step === 'basics' && (
        <div className="animate-fade-in-up">
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            {/* Gradient header */}
            <div className="sidebar-mesh p-6 pb-8">
              <h2 className="text-lg font-semibold text-white">Da dove partiamo?</h2>
              <p className="text-white/40 text-sm mt-1">
                Inserisci il nome del brand e descrivi il contesto — l&apos;AI fara il resto
              </p>
            </div>

            <CardContent className="p-6 -mt-4">
              <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2">
                    Nome del progetto
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Es. Acme Corp, Nike Italia, Fineco Bank..."
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary mb-1">
                    Contesto per l&apos;AI
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Descrivi il progetto, il settore, i servizi e il target. L&apos;AI user&agrave; questo contesto per generare keyword e competitor pertinenti.
                  </p>
                  <textarea
                    className="flex w-full rounded-xl border border-border bg-white px-4 py-3 text-sm min-h-[100px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Es. 'Banca online italiana specializzata in trading e investimenti. Competitor principali: Fineco, Directa, Degiro. Focus su ETF, azioni e conti deposito. Target: investitori retail italiani 25-55 anni.'"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="accent"
                    size="lg"
                    className="flex-1 h-12 text-base font-semibold gap-2"
                    onClick={() => {
                      if (!name.trim()) return;
                      setStep('ai-fill');
                      handleAiFill();
                    }}
                    disabled={!name.trim()}
                  >
                    <Sparkles className="w-5 h-5" />
                    Genera con AI
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 gap-2"
                    onClick={() => {
                      if (!name.trim()) return;
                      setStep('review');
                    }}
                    disabled={!name.trim()}
                  >
                    Manuale
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP 2: AI Loading */}
      {/* ============================================ */}
      {step === 'ai-fill' && (
        <div className="animate-fade-in-up">
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center">
              {/* AI animation */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-teal flex items-center justify-center animate-pulse-ring">
                  {aiDone ? (
                    <Check className="w-10 h-10 text-white animate-scale-in" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-white animate-sparkle" />
                  )}
                </div>
              </div>

              <h2 className="text-xl font-bold text-primary mb-2">
                {aiDone ? 'Configurazione pronta!' : 'Gemini sta analizzando...'}
              </h2>
              <p className="text-muted-foreground text-sm mb-8 max-w-md">
                {aiDone
                  ? 'Ho generato keyword, competitor e configurazione ottimale per il tuo progetto'
                  : `Sto cercando le migliori keyword, competitor e impostazioni per "${name}"`}
              </p>

              {/* Shimmer skeleton */}
              {aiLoading && (
                <div className="w-full max-w-md space-y-4">
                  <SkeletonField label="Industry" />
                  <SkeletonField label="Keywords" wide />
                  <SkeletonField label="Competitor" />
                  <SkeletonField label="Impostazioni" />
                </div>
              )}

              {aiDone && (
                <div className="animate-fade-in-up">
                  <p className="text-accent text-sm font-medium">Reindirizzamento...</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP 3: Review & Configure */}
      {/* ============================================ */}
      {step === 'review' && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Industry */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-semibold text-primary">Industry</h3>
                {aiDone && <AiBadge />}
              </div>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Es. fintech, automotive, food"
              />
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Search className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-semibold text-primary">Keywords</h3>
                <span className="text-xs text-muted-foreground">({keywords.length}/10)</span>
                {aiDone && <AiBadge />}
              </div>

              {/* Tags */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 stagger-children">
                  {keywords.map((kw) => (
                    <Chip key={kw} onRemove={() => setKeywords((prev) => prev.filter((k) => k !== kw))}>
                      {kw}
                    </Chip>
                  ))}
                </div>
              )}

              {/* Add input */}
              {keywords.length < 10 && (
                <div className="flex gap-2">
                  <Input
                    ref={keywordInputRef}
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Aggiungi keyword e premi Invio..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addKeyword}
                    disabled={!newKeyword.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Competitors */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange" />
                </div>
                <h3 className="font-semibold text-primary">Competitor</h3>
                <span className="text-xs text-muted-foreground">({competitors.length}/20)</span>
                {aiDone && <AiBadge />}
              </div>

              {competitors.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 stagger-children">
                  {competitors.map((c) => (
                    <Chip
                      key={c}
                      variant="orange"
                      onRemove={() => setCompetitors((prev) => prev.filter((x) => x !== c))}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              )}

              {competitors.length < 20 && (
                <div className="flex gap-2">
                  <Input
                    ref={competitorInputRef}
                    value={newCompetitor}
                    onChange={(e) => setNewCompetitor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCompetitor();
                      }
                    }}
                    placeholder="Aggiungi domini separati da virgola, es: dominio1.com, dominio2.it"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addCompetitor}
                    disabled={!newCompetitor.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sources & Settings */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-teal" />
                </div>
                <h3 className="font-semibold text-primary">Fonti e Lingua</h3>
                {aiDone && <AiBadge />}
              </div>

              {/* Sources as toggle buttons */}
              <div className="flex gap-2 mb-4">
                <ToggleButton
                  active={sources.includes('google_organic')}
                  onClick={() => toggleSource('google_organic')}
                >
                  <Search className="w-3.5 h-3.5" />
                  Google Organic
                </ToggleButton>
                <ToggleButton
                  active={sources.includes('google_news')}
                  onClick={() => toggleSource('google_news')}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Google News
                </ToggleButton>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Lingua SERP
                  </label>
                  <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Fran&ccedil;ais</option>
                    <option value="es">Espa&ntilde;ol</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Location Code
                  </label>
                  <Input
                    type="number"
                    value={locationCode}
                    onChange={(e) => setLocationCode(parseInt(e.target.value) || 2380)}
                    placeholder="2380 = Italia"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-gold" />
                </div>
                <h3 className="font-semibold text-primary">Pianificazione</h3>
                {aiDone && <AiBadge />}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Frequenza
                  </label>
                  <Select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                    <option value="manual">Manuale</option>
                    <option value="weekly">Settimanale</option>
                    <option value="monthly">Mensile</option>
                  </Select>
                </div>
                {schedule !== 'manual' && (
                  <div className="animate-fade-in-up">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      {schedule === 'weekly' ? 'Giorno settimana (0=Dom)' : 'Giorno mese (1-28)'}
                    </label>
                    <Input
                      type="number"
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(parseInt(e.target.value) || 1)}
                      min={schedule === 'weekly' ? 0 : 1}
                      max={schedule === 'weekly' ? 6 : 28}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2 pb-8">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setStep('basics')}
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="flex-1 h-12 text-base font-semibold gap-2"
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creazione in corso...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Crea Progetto
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// Sub-components
// ============================

function SkeletonField({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className="text-left">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <div className={`h-9 rounded-md animate-shimmer ${wide ? '' : 'w-3/4'}`} />
      {wide && (
        <div className="flex gap-2 mt-2">
          <div className="h-7 w-24 rounded-full animate-shimmer" />
          <div className="h-7 w-32 rounded-full animate-shimmer" style={{ animationDelay: '0.1s' }} />
          <div className="h-7 w-20 rounded-full animate-shimmer" style={{ animationDelay: '0.2s' }} />
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  onRemove,
  variant = 'accent',
}: {
  children: React.ReactNode;
  onRemove: () => void;
  variant?: 'accent' | 'orange';
}) {
  const colors =
    variant === 'accent'
      ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/15'
      : 'bg-orange/10 text-orange border-orange/20 hover:bg-orange/15';

  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-sm font-medium border transition-colors ${colors}`}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-accent/10 to-teal/10 text-accent border border-accent/20">
      <Sparkles className="w-3 h-3" />
      AI
    </span>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${active
          ? 'bg-accent text-white shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }
      `}
    >
      {children}
    </button>
  );
}
