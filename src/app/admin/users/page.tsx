'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Copy } from 'lucide-react';
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

  if (loading) return <div className="animate-pulse">Caricamento...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Utenti</h1>
        <Button variant="accent" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Utente
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crea Nuovo Utente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="cliente@progetto.local"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Nome</label>
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Nome Cliente"
                />
              </div>
              <Button type="submit" variant="accent" disabled={creating}>
                {creating ? 'Creazione...' : 'Crea'}
              </Button>
            </form>

            {tempPassword && (
              <div className="mt-4 p-3 bg-positive/10 border border-positive/20 rounded-md">
                <p className="text-sm font-medium text-positive">Utente creato! Password temporanea:</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-white px-2 py-1 rounded border">{tempPassword}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigator.clipboard.writeText(tempPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Salva questa password, non sarà più visibile.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
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
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.display_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
