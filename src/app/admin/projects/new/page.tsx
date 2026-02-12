'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    keywords: '',
    competitors: '',
    sources: ['google_organic', 'google_news'],
    schedule: 'manual',
    schedule_day: 1,
    language: 'it',
    location_code: 2380,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/admin/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        keywords: form.keywords.split('\n').map((k) => k.trim()).filter(Boolean),
        competitors: form.competitors.split('\n').map((c) => c.trim()).filter(Boolean),
      }),
    });

    if (res.ok) {
      router.push('/admin/projects');
    } else {
      const data = await res.json();
      alert('Errore: ' + data.error);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-primary mb-6">Nuovo Progetto</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configurazione</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome progetto</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Es. Monitoraggio Brand XYZ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="Es. fintech, automotive, food"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Keywords (una per riga, max 10)
              </label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[120px]"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder={"brand XYZ\ncompetitor ABC\nsettore fintech Italia"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Competitor (dominio, uno per riga, max 5)
              </label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[80px]"
                value={form.competitors}
                onChange={(e) => setForm({ ...form, competitors: e.target.value })}
                placeholder={"competitor1.com\ncompetitor2.it"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <Select
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                >
                  <option value="manual">Manuale</option>
                  <option value="weekly">Settimanale</option>
                  <option value="monthly">Mensile</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {form.schedule === 'weekly' ? 'Giorno settimana (0=Dom)' : 'Giorno mese (1-28)'}
                </label>
                <Input
                  type="number"
                  value={form.schedule_day}
                  onChange={(e) =>
                    setForm({ ...form, schedule_day: parseInt(e.target.value) || 1 })
                  }
                  min={form.schedule === 'weekly' ? 0 : 1}
                  max={form.schedule === 'weekly' ? 6 : 28}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lingua SERP</label>
                <Select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Fran&ccedil;ais</option>
                  <option value="es">Espa&ntilde;ol</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location Code</label>
                <Input
                  type="number"
                  value={form.location_code}
                  onChange={(e) =>
                    setForm({ ...form, location_code: parseInt(e.target.value) || 2380 })
                  }
                  placeholder="2380 = Italia"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="accent" disabled={loading}>
                {loading ? 'Creazione...' : 'Crea Progetto'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
