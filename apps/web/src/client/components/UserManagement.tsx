import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth-store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus } from 'lucide-react';

interface UserEntry {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}

export function UserManagement() {
  const { t } = useTranslation(['auth']);
  const { token, user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdd = async () => {
    if (!newEmail.trim() || !newName.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim(), role: newRole }),
      });
      if (res.status === 409) {
        setError(t('auth:users.emailTaken'));
      } else if (res.ok) {
        setNewEmail('');
        setNewName('');
        setNewRole('member');
        await loadUsers();
      }
    } catch { /* ignore */ }
    setIsAdding(false);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    await fetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role }),
    });
    await loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t('auth:users.deleteConfirm'))) return;
    await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers,
    });
    await loadUsers();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('auth:users.title')}</h3>

      {/* Add user form */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{t('auth:users.email')}</Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{t('auth:users.name')}</Label>
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="h-8 text-sm"
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">{t('auth:users.role')}</Label>
          <select
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'admin' | 'member' | 'viewer')}
          >
            <option value="member">{t('auth:users.member')}</option>
            <option value="admin">{t('auth:users.admin')}</option>
            <option value="viewer">{t('auth:users.viewer')}</option>
          </select>
        </div>
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={isAdding || !newEmail.trim() || !newName.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('auth:users.addUser')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* User list */}
      <div className="border rounded-md divide-y">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div className="flex-1">
              <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground ml-2">{u.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                disabled={u.id === currentUser?.id}
              >
                <option value="admin">{t('auth:users.admin')}</option>
                <option value="member">{t('auth:users.member')}</option>
                <option value="viewer">{t('auth:users.viewer')}</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(u.id)}
                disabled={u.id === currentUser?.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">No users</div>
        )}
      </div>
    </div>
  );
}
