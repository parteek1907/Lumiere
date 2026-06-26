'use client';

import {
  User,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Eye,
  Mail,
  ClipboardList,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Database,
  Plus,
  FileUp,
  CheckCircle,
  X,
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';

// ── Audit log types ──
interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  detail: string;
  category: 'auth' | 'data' | 'system' | 'privacy';
}

const mockAuditLog: AuditEntry[] = [
  { id: '1', timestamp: '2025-01-15T14:32:00Z', user: 'Dr. Parteek', action: 'Patient record viewed', target: 'Chad Abbott (89569dfe)', detail: 'Golden Record tab accessed', category: 'data' },
  { id: '2', timestamp: '2025-01-15T14:28:00Z', user: 'System', action: 'EHR sync completed', target: 'EPIC EHR', detail: '12 records ingested, 3 duplicates flagged', category: 'system' },
  { id: '3', timestamp: '2025-01-15T13:45:00Z', user: 'Dr. Parteek', action: 'Match confirmed', target: 'DUP-4821', detail: 'Records merged — composite score 91%', category: 'data' },
  { id: '4', timestamp: '2025-01-15T12:10:00Z', user: 'Dr. Parteek', action: 'Login', target: 'Session 8a3f', detail: 'IP 192.168.1.42 — Chrome/Windows', category: 'auth' },
  { id: '5', timestamp: '2025-01-15T11:55:00Z', user: 'System', action: 'Backup completed', target: 'clinical_db', detail: 'Full snapshot — 2.3 GB', category: 'system' },
  { id: '6', timestamp: '2025-01-14T16:20:00Z', user: 'Dr. Parteek', action: 'Patient created', target: 'Jane Doe (a2c1f3e8)', detail: 'Manual entry — 6 fields populated', category: 'data' },
  { id: '7', timestamp: '2025-01-14T15:00:00Z', user: 'System', action: 'FHIR validation warning', target: 'LabCorp feed', detail: '2 records missing required date field', category: 'system' },
  { id: '8', timestamp: '2025-01-14T10:30:00Z', user: 'Dr. Parteek', action: 'PDF uploaded', target: 'Chad Abbott (89569dfe)', detail: 'Lab report — OCR extracted 5 fields', category: 'data' },
  { id: '9', timestamp: '2025-01-13T09:00:00Z', user: 'Admin', action: 'Privacy policy updated', target: 'GDPR settings', detail: 'Retention period changed to 7 years', category: 'privacy' },
  { id: '10', timestamp: '2025-01-13T08:15:00Z', user: 'Dr. Parteek', action: 'Voice record saved', target: 'Patient 42f9a1b2', detail: 'Transcription — 245 words, FHIR R4 valid', category: 'data' },
  { id: '11', timestamp: '2025-01-12T17:00:00Z', user: 'System', action: 'Duplicate flagged', target: 'DUP-4822', detail: 'Composite score 73% — needs review', category: 'system' },
  { id: '12', timestamp: '2025-01-12T14:30:00Z', user: 'Dr. Parteek', action: 'Match dismissed', target: 'DUP-4819', detail: 'False positive — different patients', category: 'data' },
];

const PAGE_SIZE = 8;

// ── Erasure request types ──
interface ErasureRequest {
  id: string;
  patientName: string;
  patientId: string;
  requestedAt: string;
  status: 'pending' | 'processing' | 'completed';
}

// ── Data Sources types ──
type SourceType = 'rest_api' | 'csv' | 'hl7' | 'manual';
interface ConnectedSource {
  id: string;
  name: string;
  type: SourceType;
  status: 'active' | 'inactive' | 'error';
  lastSync: string;
  recordCount: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Profile');
  const [profile, setProfile] = useState({ fullName: '', email: '', role: '', institution: '' });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const role = localStorage.getItem('role') || 'doctor';
    const displayRole = role === 'patient' ? 'Patient' : 'Clinician';
    setProfile({
      fullName: stored.fullName || (role === 'patient' ? 'John Doe' : 'Dr. Parteek'),
      email: stored.email || '',
      role: displayRole,
      institution: stored.institution || 'Lumiere Health',
    });
  }, []);
  const [toast, setToast] = useState<string | null>(null);

  // Audit log state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<'all' | AuditEntry['category']>('all');
  const [auditPage, setAuditPage] = useState(0);

  // Privacy — erasure requests
  const [erasureRequests, setErasureRequests] = useState<ErasureRequest[]>([
    { id: '1', patientName: 'Jane Doe', patientId: 'a2c1f3e8', requestedAt: '2025-01-14T10:00:00Z', status: 'pending' },
    { id: '2', patientName: 'John Smith', patientId: 'b3d2e4f9', requestedAt: '2025-01-10T08:00:00Z', status: 'completed' },
  ]);
  const [erasureConfirmId, setErasureConfirmId] = useState<string | null>(null);

  // Data Sources state
  const [connectedSources, setConnectedSources] = useState<ConnectedSource[]>([
    { id: '1', name: 'EPIC EHR', type: 'rest_api', status: 'active', lastSync: '2025-01-15T14:28:00Z', recordCount: 412 },
    { id: '2', name: 'LabCorp Feed', type: 'hl7', status: 'active', lastSync: '2025-01-15T10:00:00Z', recordCount: 187 },
    { id: '3', name: 'PDF Archive', type: 'csv', status: 'inactive', lastSync: '2025-01-10T09:00:00Z', recordCount: 56 },
    { id: '4', name: 'Manual Entry', type: 'manual', status: 'active', lastSync: '—', recordCount: 45 },
  ]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState(0);
  const [connectForm, setConnectForm] = useState({
    name: '',
    type: '' as SourceType | '',
    endpoint: '',
    apiKey: '',
    hl7Port: '',
    file: null as File | null,
  });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const existing = JSON.parse(localStorage.getItem('userProfile') || '{}');
    localStorage.setItem('userProfile', JSON.stringify({ ...existing, fullName: profile.fullName, email: profile.email, institution: profile.institution }));
    setToast('Settings saved');
    setTimeout(() => setToast(null), 3000);
  };

  const filteredAudit = useMemo(() => {
    let entries = mockAuditLog;
    if (auditCategory !== 'all') entries = entries.filter(e => e.category === auditCategory);
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      entries = entries.filter(e =>
        e.action.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q)
      );
    }
    return entries;
  }, [auditSearch, auditCategory]);

  const totalAuditPages = Math.ceil(filteredAudit.length / PAGE_SIZE);
  const pagedAudit = filteredAudit.slice(auditPage * PAGE_SIZE, (auditPage + 1) * PAGE_SIZE);

  const handleExportCsv = () => {
    const header = 'Timestamp,User,Action,Target,Detail,Category';
    const rows = filteredAudit.map(e =>
      `"${new Date(e.timestamp).toLocaleString()}","${e.user}","${e.action}","${e.target}","${e.detail}","${e.category}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Audit log exported');
    setTimeout(() => setToast(null), 3000);
  };

  const handleProcessErasure = (id: string) => {
    setErasureRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'completed' as const } : r)
    );
    setErasureConfirmId(null);
    setToast('Erasure request processed — patient data removed');
    setTimeout(() => setToast(null), 3000);
  };

  const handleConnectSource = () => {
    if (!connectForm.name || !connectForm.type) return;
    const newSource: ConnectedSource = {
      id: String(Date.now()),
      name: connectForm.name,
      type: connectForm.type as SourceType,
      status: 'active',
      lastSync: new Date().toISOString(),
      recordCount: 0,
    };
    setConnectedSources(prev => [...prev, newSource]);
    setConnectModalOpen(false);
    setConnectStep(0);
    setConnectForm({ name: '', type: '', endpoint: '', apiKey: '', hl7Port: '', file: null });
    setToast(`${newSource.name} connected successfully`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRemoveSource = (id: string) => {
    setConnectedSources(prev => prev.filter(s => s.id !== id));
    setToast('Source disconnected');
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = [
    { name: 'Profile', icon: User },
    { name: 'Notifications', icon: Bell },
    { name: 'Security', icon: Shield },
    { name: 'Privacy', icon: Eye },
    { name: 'Audit Log', icon: ClipboardList },
    { name: 'Data Sources', icon: Database },
    { name: 'System', icon: SettingsIcon },
  ];

  const auditCategoryBadge: Record<AuditEntry['category'], string> = {
    auth: 'bg-blue-50 text-blue-700 border-blue-200',
    data: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    system: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    privacy: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-black">Settings</h1>
        <p className="text-[14px] text-neutral-500 mt-1">Manage your account preferences and system configuration.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden flex min-h-[520px]">
        {/* Tab sidebar */}
        <div className="w-56 border-r border-neutral-100 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => { setActiveTab(tab.name); setAuditPage(0); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-150',
                activeTab === tab.name
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:text-black hover:bg-neutral-50'
              )}
            >
              <tab.icon size={16} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          {activeTab === 'Profile' && (
            <div className="space-y-6 max-w-lg">
              <div className="flex items-center gap-5 pb-6 border-b border-neutral-100">
                <div className="w-[72px] h-[72px] rounded-full bg-neutral-100 flex items-center justify-center text-[22px] font-bold text-neutral-400 border border-neutral-200">
                  {profile.fullName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-black">Profile picture</h3>
                  <div className="flex gap-2 mt-2">
                    <button className="px-3 py-1.5 rounded-lg bg-black text-white text-[13px] font-medium hover:bg-neutral-800 transition-colors">Change photo</button>
                    <button className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 text-[13px] font-medium hover:border-[#C8C8C8] transition-colors">Remove</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Full name</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full h-10 px-3 pr-9 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 w-4 h-4" />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Role</label>
                  <input
                    type="text"
                    value={profile.role}
                    disabled
                    className="w-full h-10 px-3 rounded-lg bg-neutral-50 border border-[#E0E0E0] text-[14px] text-neutral-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Institution</label>
                  <input
                    type="text"
                    value={profile.institution}
                    onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-black text-white text-[14px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.99] transition-all duration-150"
                >
                  Save changes
                </button>
              </div>
              <button className="text-[13px] text-neutral-400 hover:text-black transition-colors">
                Reset to defaults
              </button>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="space-y-6 max-w-lg">
              <div className="bg-black text-white rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="text-blue-400" size={16} />
                    <h4 className="text-[14px] font-semibold">Two-factor authentication</h4>
                  </div>
                  <span className="text-[10px] font-medium bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-[0.06em]">Active</span>
                </div>
                <p className="text-neutral-400 text-[13px]">Add an extra layer of security to your clinical account.</p>
              </div>
            </div>
          )}

          {activeTab === 'Privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-semibold text-black">GDPR — Right to Erasure</h3>
                <p className="text-[13px] text-neutral-500 mt-1">Manage patient data erasure requests under GDPR Article 17.</p>
              </div>

              <div className="bg-white border border-[#EBEBEB] rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Patient</th>
                      <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Requested</th>
                      <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Status</th>
                      <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {erasureRequests.map(r => (
                      <tr key={r.id} className="hover:bg-neutral-50 transition-colors duration-100">
                        <td className="px-4 py-3">
                          <p className="text-[14px] font-medium text-black">{r.patientName}</p>
                          <p className="text-[11px] font-mono text-neutral-400">{r.patientId}</p>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-neutral-500">{new Date(r.requestedAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            r.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            r.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          )}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => setErasureConfirmId(r.id)}
                              className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg border border-red-200 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-all duration-150"
                            >
                              <Trash2 size={13} /> Process
                            </button>
                          )}
                          {r.status === 'completed' && (
                            <span className="text-[12px] text-neutral-400">Done</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
                <p className="text-[12px] text-neutral-500">
                  <strong>Note:</strong> Processing an erasure request permanently removes all patient data from all source systems,
                  golden records, audit logs, and duplicate candidates. This action cannot be undone.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Audit Log' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-black">Audit log</h3>
                  <p className="text-[13px] text-neutral-400 mt-0.5">{filteredAudit.length} entries</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-300" />
                  <input
                    type="text"
                    placeholder="Search audit log..."
                    value={auditSearch}
                    onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(0); }}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(['all', 'auth', 'data', 'system', 'privacy'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setAuditCategory(cat); setAuditPage(0); }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[12px] font-medium capitalize transition-all duration-150',
                        auditCategory === cat ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-[#EBEBEB] rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Timestamp</th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">User</th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Action</th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Target</th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {pagedAudit.map(entry => (
                      <tr key={entry.id} className="hover:bg-neutral-50 transition-colors duration-100">
                        <td className="px-4 py-2.5 text-[12px] text-neutral-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-[13px] text-black font-medium">{entry.user}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-[13px] text-black">{entry.action}</p>
                          <p className="text-[11px] text-neutral-400">{entry.detail}</p>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-neutral-600">{entry.target}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize', auditCategoryBadge[entry.category])}>
                            {entry.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {pagedAudit.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-neutral-400">No entries match your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalAuditPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-neutral-400">
                    Showing {auditPage * PAGE_SIZE + 1}–{Math.min((auditPage + 1) * PAGE_SIZE, filteredAudit.length)} of {filteredAudit.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      disabled={auditPage === 0}
                      onClick={() => setAuditPage(p => p - 1)}
                      className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-black hover:border-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      disabled={auditPage >= totalAuditPages - 1}
                      onClick={() => setAuditPage(p => p + 1)}
                      className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-black hover:border-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Data Sources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-black">Connected sources</h3>
                  <p className="text-[13px] text-neutral-400 mt-0.5">{connectedSources.length} data source{connectedSources.length !== 1 ? 's' : ''} configured</p>
                </div>
                <button
                  onClick={() => { setConnectModalOpen(true); setConnectStep(0); setConnectForm({ name: '', type: '', endpoint: '', apiKey: '', hl7Port: '', file: null }); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                >
                  <Plus size={14} /> Connect source
                </button>
              </div>

              <div className="bg-white border border-[#EBEBEB] rounded-xl divide-y divide-neutral-50">
                {connectedSources.map(s => {
                  const typeLabel: Record<SourceType, string> = { rest_api: 'REST API', csv: 'CSV', hl7: 'HL7', manual: 'Manual' };
                  return (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors duration-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-2 h-2 rounded-full', s.status === 'active' ? 'bg-emerald-500' : s.status === 'error' ? 'bg-red-500' : 'bg-neutral-300')} />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-black truncate">{s.name}</p>
                          <p className="text-[11px] text-neutral-400">{typeLabel[s.type]} — {s.recordCount} records — Last sync: {s.lastSync === '—' ? '—' : new Date(s.lastSync).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                          s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-neutral-100 text-neutral-500 border-neutral-200'
                        )}>{s.status}</span>
                        <button
                          onClick={() => handleRemoveSource(s.id)}
                          className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {connectedSources.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-neutral-400">No sources connected. Click &quot;Connect source&quot; to add one.</div>
                )}
              </div>
            </div>
          )}

          {(activeTab === 'Notifications' || activeTab === 'System') && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <SettingsIcon size={32} className="text-neutral-200 mb-3" />
              <p className="text-[13px] text-neutral-400">{activeTab} settings coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Connect source modal */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setConnectModalOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-[520px] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-black">Connect data source</h2>
                <p className="text-[13px] text-neutral-400 mt-1">Step {connectStep + 1} of 2</p>
              </div>
              <button onClick={() => setConnectModalOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              {connectStep === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Source name</label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Hospital EHR"
                      value={connectForm.name}
                      onChange={e => setConnectForm({ ...connectForm, name: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-2 block">Source type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: 'rest_api' as const, label: 'REST API', desc: 'FHIR-compatible endpoint' },
                        { key: 'csv' as const, label: 'CSV Import', desc: 'Upload CSV files' },
                        { key: 'hl7' as const, label: 'HL7 v2', desc: 'HL7 message feed' },
                        { key: 'manual' as const, label: 'Manual', desc: 'Manual data entry' },
                      ]).map(t => (
                        <button
                          key={t.key}
                          onClick={() => setConnectForm({ ...connectForm, type: t.key })}
                          className={cn(
                            'p-3 rounded-lg border text-left transition-all duration-150',
                            connectForm.type === t.key ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                          )}
                        >
                          <p className="text-[13px] font-medium text-black">{t.label}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {connectStep === 1 && (
                <div className="space-y-4">
                  {connectForm.type === 'rest_api' && (
                    <>
                      <div>
                        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">API Endpoint</label>
                        <input
                          type="url"
                          placeholder="https://ehr.example.com/fhir/r4"
                          value={connectForm.endpoint}
                          onChange={e => setConnectForm({ ...connectForm, endpoint: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">API Key</label>
                        <input
                          type="password"
                          placeholder="Enter API key"
                          value={connectForm.apiKey}
                          onChange={e => setConnectForm({ ...connectForm, apiKey: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                        />
                      </div>
                    </>
                  )}
                  {connectForm.type === 'csv' && (
                    <div>
                      <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-2 block">Upload CSV file</label>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setConnectForm({ ...connectForm, file: f }); }}
                      />
                      <div
                        className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-neutral-200 rounded-lg cursor-pointer hover:border-neutral-300 transition-colors"
                        onClick={() => csvInputRef.current?.click()}
                      >
                        <FileUp size={24} className="text-neutral-300" />
                        {connectForm.file ? (
                          <p className="text-[14px] text-black font-medium">{connectForm.file.name}</p>
                        ) : (
                          <p className="text-[14px] text-neutral-500">Drop CSV here or click to upload</p>
                        )}
                      </div>
                    </div>
                  )}
                  {connectForm.type === 'hl7' && (
                    <>
                      <div>
                        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">HL7 Listener Port</label>
                        <input
                          type="text"
                          placeholder="e.g. 2575"
                          value={connectForm.hl7Port}
                          onChange={e => setConnectForm({ ...connectForm, hl7Port: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Endpoint URL</label>
                        <input
                          type="url"
                          placeholder="tcp://hl7.example.com:2575"
                          value={connectForm.endpoint}
                          onChange={e => setConnectForm({ ...connectForm, endpoint: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                        />
                      </div>
                    </>
                  )}
                  {connectForm.type === 'manual' && (
                    <div className="flex items-center gap-3 py-4 px-4 bg-neutral-50 rounded-lg">
                      <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-[14px] font-medium text-black">Ready to connect</p>
                        <p className="text-[13px] text-neutral-500">Manual entry sources don&apos;t require configuration. Records will be added through the patient detail page.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              {connectStep === 0 ? (
                <>
                  <button
                    onClick={() => setConnectModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!connectForm.name || !connectForm.type}
                    onClick={() => setConnectStep(1)}
                    className="px-5 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setConnectStep(0)}
                    className="px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConnectSource}
                    className="flex items-center gap-1.5 px-5 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                  >
                    <Database size={14} /> Connect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Erasure confirmation modal */}
      {erasureConfirmId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setErasureConfirmId(null)}>
          <div className="bg-white rounded-xl w-full max-w-[440px] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <h2 className="text-[16px] font-semibold text-black">Confirm data erasure</h2>
              </div>
              <p className="text-[14px] text-neutral-500 leading-relaxed">
                This will <strong className="text-black">permanently delete</strong> all data for this patient across all systems.
                This action is irreversible and complies with GDPR Article 17.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => setErasureConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessErasure(erasureConfirmId)}
                className="flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 active:scale-[0.97] transition-all duration-150"
              >
                <Trash2 size={14} /> Erase permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] toast-enter bg-white border border-neutral-200 border-l-4 border-l-emerald-500 rounded-lg px-4 py-3 shadow-lg">
          <span className="text-[14px] text-black">{toast}</span>
        </div>
      )}
    </div>
  );
}
