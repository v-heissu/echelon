'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'no_profile'
      ? 'Account non configurato. Contatta l\'amministratore.'
      : ''
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Credenziali non valide');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px] animate-fade-in-up">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center mb-5 animate-float">
          <img src="/logo.png" alt="Echelon" width={80} height={80} className="rounded-2xl" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          ECHELON
        </h1>
        <p className="text-white/35 mt-2 text-sm font-medium tracking-wide">Web Intelligence Monitor</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="bg-white/[0.06] backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-5 ring-1 ring-white/[0.08]"
      >
        <div>
          <label htmlFor="email" className="block text-[11px] font-semibold text-white/40 mb-2 uppercase tracking-wider">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@esempio.it"
            required
            className="h-12 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 focus:border-accent/50 focus:ring-accent/30"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[11px] font-semibold text-white/40 mb-2 uppercase tracking-wider">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-12 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 focus:border-accent/50 focus:ring-accent/30"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        <Button type="submit" variant="accent" className="w-full h-12 text-sm font-semibold rounded-xl" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Accesso in corso...
            </>
          ) : (
            'Accedi'
          )}
        </Button>
      </form>

      <p className="text-center text-[11px] text-white/20 mt-8 font-medium">
        Pro Web Digital Consulting — Cerved Group S.p.A.
      </p>
    </div>
  );
}
