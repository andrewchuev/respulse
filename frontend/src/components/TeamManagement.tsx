import React, { useState, useEffect } from 'react';
import { InviteMemberPayload, TeamMember, UserProfile, UserRole } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { timeAgo } from '../lib/utils';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  UserPlus,
  Trash2,
  RefreshCw,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  deleteTeamMember,
  fetchTeamMembers,
  inviteTeamMember,
  updateMemberRole,
} from '../api/client';

interface TeamManagementProps {
  currentUser: UserProfile | null;
  onUserRefreshed?: () => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ currentUser, onUserRefreshed }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ENGINEER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Permissions matrix accordion state
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  const canManageTeam = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    try {
      await updateMemberRole(memberId, newRole);
      setSuccessMsg('Member role updated successfully');
      loadMembers();
      if (onUserRefreshed) onUserRefreshed();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!window.confirm(`Are you sure you want to remove ${member.name} (${member.email}) from the organization?`)) {
      return;
    }

    try {
      await deleteTeamMember(member.id);
      setSuccessMsg(`${member.name} removed from organization`);
      loadMembers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Name and email are required');
      return;
    }

    setInviting(true);
    setInviteError(null);
    try {
      const payload: InviteMemberPayload = {
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      };

      await inviteTeamMember(payload);
      setIsInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('ENGINEER');
      setSuccessMsg(`Invitation sent to ${payload.email}`);
      loadMembers();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            👑 OWNER
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
            🛡️ ADMIN
          </span>
        );
      case 'ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            🛠️ ENGINEER
          </span>
        );
      case 'VIEWER':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-300 border border-zinc-500/30">
            👁️ VIEWER
          </span>
        );
    }
  };

  const countRole = (role: UserRole) => members.filter((m) => m.role === role).length;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-400" />
            Team Members & Access Control (RBAC)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage organization team members, security access levels, and granular role permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadMembers}
            className="h-9 px-2.5 border-border/80 text-xs text-muted-foreground hover:text-white"
            title="Refresh team list"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {canManageTeam && (
            <Button
              size="sm"
              onClick={() => setIsInviteOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-9 text-xs gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-3 text-xs rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 text-xs rounded-xl bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">Total Members</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{members.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Active enterprise seats</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-secondary/50 border border-border/60 flex items-center justify-center text-muted-foreground">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">Admins & Owners</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {countRole('OWNER') + countRole('ADMIN')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Full security management</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">Engineers / SRE</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{countRole('ENGINEER')}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Monitors, probes & RCA</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">Viewers</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{countRole('VIEWER')}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Stakeholder read-only</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center text-zinc-400">
              <Eye className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Permissions Matrix Accordion */}
      <div className="border border-border/70 rounded-xl bg-card/30 backdrop-blur overflow-hidden">
        <button
          type="button"
          onClick={() => setIsMatrixOpen(!isMatrixOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Enterprise Role Permissions Matrix</span>
            <span className="text-[11px] text-muted-foreground font-mono">(Click to expand details)</span>
          </div>
          {isMatrixOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {isMatrixOpen && (
          <div className="p-4 pt-0 overflow-x-auto border-t border-border/50">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-mono text-[11px]">
                  <th className="py-2.5 pr-4">Capability / Resource</th>
                  <th className="py-2.5 px-3 text-center text-purple-300">👑 OWNER</th>
                  <th className="py-2.5 px-3 text-center text-blue-300">🛡️ ADMIN</th>
                  <th className="py-2.5 px-3 text-center text-emerald-300">🛠️ ENGINEER</th>
                  <th className="py-2.5 pl-3 text-center text-zinc-400">👁️ VIEWER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-[11px]">
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">View Dashboards, Status & Response Latency</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Full</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Full</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Full</td>
                  <td className="py-2.5 pl-3 text-center text-emerald-400">✅ Read-only</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Create, Edit & Delete Synthetic Targets</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Trigger Immediate "Test Now" & Pause Probing</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Bulk Actions (Mass Pause, Tagging, Folders)</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Declare Incidents & Post Live Timeline Updates</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Author & Publish Post-Mortems (RCA)</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Configure Notification Channels (Telegram, Slack, etc.)</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Invite Members & Assign Security Roles</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Yes</td>
                  <td className="py-2.5 px-3 text-center text-red-400">❌ Forbidden</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-foreground font-medium">Organization Ownership & Billing Transfer</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400">✅ Exclusive</td>
                  <td className="py-2.5 px-3 text-center text-red-400">❌ Forbidden</td>
                  <td className="py-2.5 px-3 text-center text-red-400">❌ Forbidden</td>
                  <td className="py-2.5 pl-3 text-center text-red-400">❌ Forbidden</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="border border-border/70 rounded-xl bg-card/40 backdrop-blur overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Team Members ({members.length})
          </h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            Current User: <span className="text-white font-medium">{currentUser?.name}</span> ({currentUser?.role})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {members.map((member) => {
              const isCurrentUser = member.id === currentUser?.id;
              const isOwner = member.role === 'OWNER';

              return (
                <div
                  key={member.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={member.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`}
                      alt={member.name}
                      className="h-10 w-10 rounded-full border border-border object-cover bg-secondary"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm truncate">{member.name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                        {getRoleBadge(member.role as UserRole)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span className="truncate">{member.email}</span>
                        <span>•</span>
                        <span>Joined {timeAgo(member.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Role Selector */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {canManageTeam && !isOwner ? (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-muted-foreground font-mono">Role:</label>
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                          className="bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-8 focus:ring-1 focus:ring-emerald-500 font-mono"
                        >
                          <option value="ADMIN">🛡️ ADMIN</option>
                          <option value="ENGINEER">🛠️ ENGINEER</option>
                          <option value="VIEWER">👁️ VIEWER</option>
                        </select>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveMember(member)}
                          className="h-8 px-2 text-destructive border-border/80 hover:bg-destructive/10 hover:border-destructive/40"
                          title="Remove user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono italic">
                        {isOwner ? 'Organization Owner (Fixed)' : 'Read-only access'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white">Invite Team Member</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Grant new colleagues access to ResPulse with a specific security role.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-3.5 pt-2">
            {inviteError && (
              <div className="p-2.5 text-xs rounded bg-destructive/15 border border-destructive/30 text-destructive">
                {inviteError}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Full Name</label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                required
                className="h-9 text-xs bg-slate-950/80 border-slate-700/80 focus:border-emerald-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Corporate Email Address</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. sarah.connor@enterprise.com"
                required
                className="h-9 text-xs bg-slate-950/80 border-slate-700/80 focus:border-emerald-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Role & Security Tier</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500 text-white"
              >
                <option value="ADMIN">🛡️ ADMIN — Full monitoring & team management</option>
                <option value="ENGINEER">🛠️ ENGINEER — Create/edit monitors, run tests & declare RCA</option>
                <option value="VIEWER">👁️ VIEWER — Read-only access to dashboards & incident reports</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(false)} disabled={inviting}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={inviting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {inviting ? 'Inviting...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
