'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Loader2 } from 'lucide-react';

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
    <div className="w-full max-w-md animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-teal mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          ECHELON
        </h1>
        <p className="text-white/50 mt-2 text-sm">Web Intelligence Monitor</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="bg-white rounded-xl shadow-2xl p-8 space-y-5"
      >
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@esempio.it"
            required
            className="h-11"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-11"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        <Button type="submit" variant="accent" className="w-full h-11 text-sm font-semibold" disabled={loading}>
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

      <p className="text-center text-xs text-white/30 mt-6">
        Pro Web Digital Consulting — Cerved Group S.p.A.
      </p>
    </div>
  );
}
