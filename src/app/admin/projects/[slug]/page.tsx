'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Settings, Users, Save, Loader2 } from 'lucide-react';
import { Project, User } from '@/types/database';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [projectUsers, setProjectUsers] = useState<{ user_id: string; role: string; users: User }[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [form, setForm] = useState({
    name: '',
    industry: '',
    keywords: '',
    competitors: '',
    schedule: 'manual',
    schedule_day: 1,
    language: 'it',
    location_code: 2380,
    is_active: true,
  });

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/admin/projects/${slug}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      setProjectUsers(data.project_users || []);
      setForm({
        name: data.name,
        industry: data.industry || '',
        keywords: (data.keywords as string[]).join('\n'),
        competitors: (data.competitors as string[]).join('\n'),
        schedule: data.schedule,
        schedule_day: data.schedule_day,
        language: data.language,
        location_code: data.location_code,
        is_active: data.is_active,
      });
    }
    setLoading(false);
  }, [slug]);

  const loadAllUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.filter((u: User) => u.role === 'client'));
    }
  }, []);

  useEffect(() => {
    loadProject();
    loadAllUsers();
  }, [loadProject, loadAllUsers]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch(`/api/admin/projects/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        keywords: form.keywords.split('\n').map((k) => k.trim()).filter(Boolean),
        competitors: form.competitors.split('\n').map((c) => c.trim()).filter(Boolean),
      }),
    });

    if (res.ok) {
      alert('Progetto aggiornato');
    } else {
      const data = await res.json();
      alert('Errore: ' + data.error);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Eliminare il progetto? Tutti i dati saranno persi.')) return;

    try {
      const res = await fetch(`/api/admin/projects/${slug}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/projects');
      } else {
        const data = await res.json();
        alert('Errore eliminazione: ' + data.error);
      }
    } catch {
      alert('Errore di rete durante l\'eliminazione.');
    }
  }

  async function addUser() {
    if (!selectedUserId) return;
    const res = await fetch(`/api/admin/projects/${slug}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUserId, role: 'viewer' }),
    });
    if (res.ok) {
      loadProject();
      setSelectedUserId('');
    }
  }

  async function removeUser(userId: string) {
    const res = await fetch(`/api/admin/projects/${slug}/users`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      loadProject();
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4 animate-fade-in-up">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="h-96 rounded-lg animate-shimmer" />
      </div>
    );
  }
  if (!project) return <div className="text-muted-foreground">Progetto non trovato</div>;

  const assignedIds = new Set(projectUsers.map((pu) => pu.user_id));
  const availableUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Configurazione e gestione progetto</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
          <Trash2 className="h-4 w-4" />
          Elimina
        </Button>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-accent" />
            </div>
            <h3 className="font-semibold text-primary">Configurazione</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Industry</label>
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Keywords (una per riga)</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[100px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Competitor (uno per riga)</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[80px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground"
                value={form.competitors}
                onChange={(e) => setForm({ ...form, competitors: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Schedule</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Giorno</label>
                <Input
                  type="number"
                  value={form.schedule_day}
                  onChange={(e) =>
                    setForm({ ...form, schedule_day: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lingua</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Location Code</label>
                <Input
                  type="number"
                  value={form.location_code}
                  onChange={(e) =>
                    setForm({ ...form, location_code: parseInt(e.target.value) || 2380 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.is_active ? 'bg-accent' : 'bg-border'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.is_active ? 'left-5' : 'left-1'}`} />
              </button>
              <label className="text-sm font-medium text-primary">Progetto attivo</label>
            </div>

            <Button type="submit" variant="accent" disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salva Modifiche
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-teal" />
            </div>
            <h3 className="font-semibold text-primary">Utenti Associati</h3>
          </div>

          {projectUsers.length > 0 ? (
            <div className="space-y-1 mb-4">
              {projectUsers.map((pu) => (
                <div
                  key={pu.user_id}
                  className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <span className="font-medium text-sm">{pu.users?.display_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pu.users?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pu.role}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeUser(pu.user_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4 py-3">Nessun utente associato</p>
          )}

          {availableUsers.length > 0 && (
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 mt-3"
              >
                <option value="">Seleziona utente...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.email})
                  </option>
                ))}
              </Select>
              <Button variant="accent" size="sm" onClick={addUser} className="gap-1.5 mt-3">
                <UserPlus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
