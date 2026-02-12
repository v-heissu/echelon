'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function LoginForm() {
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
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          ECHELON
        </h1>
        <p className="text-accent-light mt-2 text-sm">Web Monitor</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="bg-white rounded-lg shadow-xl p-8 space-y-6"
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-primary mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@esempio.it"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-primary mb-1">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        <Button type="submit" variant="accent" className="w-full" disabled={loading}>
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </Button>
      </form>

      <p className="text-center text-xs text-border mt-6">
        Pro Web Digital Consulting — Cerved Group S.p.A.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
