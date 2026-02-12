'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus } from 'lucide-react';
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

  useEffect(() => {
    loadProject();
    loadAllUsers();
  }, [slug]);

  async function loadProject() {
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
  }

  async function loadAllUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.filter((u: User) => u.role === 'client'));
    }
  }

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

    const res = await fetch(`/api/admin/projects/${slug}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/projects');
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

  if (loading) return <div className="animate-pulse">Caricamento...</div>;
  if (!project) return <div>Progetto non trovato</div>;

  const assignedIds = new Set(projectUsers.map((pu) => pu.user_id));
  const availableUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{project.name}</h1>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          Elimina
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurazione</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Keywords</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[100px]"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Competitor</label>
              <textarea
                className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm min-h-[80px]"
                value={form.competitors}
                onChange={(e) => setForm({ ...form, competitors: e.target.value })}
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
                <label className="block text-sm font-medium mb-1">Giorno</label>
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
                <label className="block text-sm font-medium mb-1">Lingua</label>
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
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                id="active"
              />
              <label htmlFor="active" className="text-sm">Progetto attivo</label>
            </div>

            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utenti Associati</CardTitle>
        </CardHeader>
        <CardContent>
          {projectUsers.length > 0 ? (
            <div className="space-y-2 mb-4">
              {projectUsers.map((pu) => (
                <div
                  key={pu.user_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <span className="font-medium">{pu.users?.display_name}</span>
                    <span className="text-sm text-muted-foreground ml-2">{pu.users?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pu.role}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUser(pu.user_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">Nessun utente associato</p>
          )}

          {availableUsers.length > 0 && (
            <div className="flex gap-2">
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1"
              >
                <option value="">Seleziona utente...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.email})
                  </option>
                ))}
              </Select>
              <Button variant="accent" size="sm" onClick={addUser}>
                <UserPlus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
