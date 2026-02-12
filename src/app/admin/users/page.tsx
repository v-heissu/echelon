'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Copy, Users, Check, UserPlus } from 'lucide-react';
import { User } from '@/types/database';

interface UserWithProjects extends User {
  project_users: { project_id: string; role: string; projects: { name: string; slug: string } }[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithProjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setTempPassword('');

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, display_name: newDisplayName }),
    });

    if (res.ok) {
      const data = await res.json();
      setTempPassword(data.temp_password);
      loadUsers();
      setNewEmail('');
      setNewDisplayName('');
    } else {
      const data = await res.json();
      alert('Errore: ' + data.error);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo utente?')) return;

    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up space-y-4">
        <div className="h-8 w-32 rounded-lg animate-shimmer" />
        <div className="h-64 rounded-lg animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary">Utenti</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} utenti registrati</p>
        </div>
        <Button
          variant="accent"
          onClick={() => setShowCreate(!showCreate)}
          className="gap-2 shadow-md shadow-accent/20"
        >
          <Plus className="h-4 w-4" />
          Nuovo Utente
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6 border-0 shadow-md overflow-hidden animate-fade-in-up">
          <div className="h-1 bg-gradient-to-r from-accent to-teal" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-semibold text-primary">Crea Nuovo Utente</h3>
            </div>

            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="cliente@progetto.local"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Nome Cliente"
                />
              </div>
              <Button type="submit" variant="accent" disabled={creating} className="gap-1.5">
                {creating ? 'Creazione...' : 'Crea'}
              </Button>
            </form>

            {tempPassword && (
              <div className="mt-4 p-4 bg-positive/10 border border-positive/20 rounded-lg animate-fade-in-up">
                <p className="text-sm font-semibold text-positive">Utente creato con successo!</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-sm bg-white px-3 py-1.5 rounded-md border font-mono">{tempPassword}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Salva questa password, non sara piu visibile.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Progetti</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{user.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.project_users?.map((pu) => (
                        <Badge key={pu.project_id} variant="neutral" className="text-xs">
                          {pu.projects?.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">Nessun utente registrato</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
