'use client';

import {
  User, Settings as SettingsIcon, Bell, Shield, Eye, Mail, ClipboardList, Download, Search,
  Trash2, AlertTriangle, Database, Plus, FileUp, CheckCircle, X,
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
      fullName: stored.fullName || (role === 'patient' ? 'John Doe' : 'Dr. Kim'),
      email: stored.email || 'dr.kim@lumiere.com',
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
  ]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState(0);
  const [connectForm, setConnectForm] = useState({
    name: '', type: '' as SourceType | '', endpoint: '', apiKey: '', hl7Port: '', file: null as File | null,
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
      entries = entries.filter(e => e.action.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || e.user.toLowerCase().includes(q));
    }
    return entries;
  }, [auditSearch, auditCategory]);

  const totalAuditPages = Math.ceil(filteredAudit.length / PAGE_SIZE);
  const pagedAudit = filteredAudit.slice(auditPage * PAGE_SIZE, (auditPage + 1) * PAGE_SIZE);

  const handleExportCsv = () => {
    setToast('Audit log exported');
    setTimeout(() => setToast(null), 3000);
  };

  const handleProcessErasure = (id: string) => {
    setErasureRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'completed' as const } : r));
    setErasureConfirmId(null);
    setToast('Erasure request processed');
    setTimeout(() => setToast(null), 3000);
  };

  const handleConnectSource = () => {
    if (!connectForm.name || !connectForm.type) return;
    setConnectedSources(prev => [...prev, { id: String(Date.now()), name: connectForm.name, type: connectForm.type as SourceType, status: 'active', lastSync: new Date().toISOString(), recordCount: 0 }]);
    setConnectModalOpen(false);
    setConnectStep(0);
    setConnectForm({ name: '', type: '', endpoint: '', apiKey: '', hl7Port: '', file: null });
    setToast('Source connected successfully');
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

  return (
    <div className="w-full max-w-[1400px] mx-auto p-12">
      
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-800">Platform <span className="text-brand-blue">Settings</span></h1>
        <p className="text-gray-500 mt-2">Manage your account preferences, integrations, and system configurations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0 bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => { setActiveTab(tab.name); setAuditPage(0); }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-200',
                activeTab === tab.name
                  ? 'bg-blue-50 text-brand-blue shadow-sm'
                  : 'text-gray-500 hover:text-brand-blue hover:bg-gray-50'
              )}
            >
              <tab.icon size={18} strokeWidth={activeTab === tab.name ? 2.5 : 2} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 min-h-[600px]">
          
          {activeTab === 'Profile' && (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-800 mb-8">Personal Information</h2>
              
              <div className="flex items-center gap-6 pb-8 border-b border-gray-100 mb-8">
                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-brand-blue border-4 border-white shadow-sm">
                  {profile.fullName?.[0]?.toUpperCase() || 'K'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Profile Picture</h3>
                  <div className="flex gap-3">
                    <button className="px-5 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">Upload New</button>
                    <button className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors">Remove</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Full Name</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                    className="w-full bg-gray-50 text-gray-700 rounded-xl py-3 px-4 outline-none border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-gray-50 text-gray-700 rounded-xl py-3 pl-11 pr-4 outline-none border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Clinical Role</label>
                  <input
                    type="text"
                    value={profile.role}
                    disabled
                    className="w-full bg-gray-100 text-gray-500 rounded-xl py-3 px-4 border border-gray-200 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Institution</label>
                  <input
                    type="text"
                    value={profile.institution}
                    onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
                    className="w-full bg-gray-50 text-gray-700 rounded-xl py-3 px-4 outline-none border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-10 mt-10 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={handleSave}
                  className="px-8 py-3 bg-brand-blue text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md transition-all duration-200 active:scale-95"
                >
                  Save Changes
                </button>
                <button className="text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors">
                  Discard
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-xl font-bold text-gray-800 mb-8">Security Preferences</h2>
               <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-[2rem] p-8 shadow-md relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                          <Shield className="text-blue-400" size={20} />
                        </div>
                        <h4 className="text-lg font-bold">Two-Factor Auth</h4>
                      </div>
                      <span className="text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-full shadow-sm">ACTIVE</span>
                    </div>
                    <p className="text-gray-300 font-medium max-w-sm mb-6">Your clinical account is currently protected by TOTP-based Two-Factor Authentication.</p>
                    <button className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors backdrop-blur-sm border border-white/10">Manage 2FA</button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'Audit Log' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">System Audit Log</h2>
                  <p className="text-gray-500 mt-1 font-medium">Immutable ledger of system activity.</p>
                </div>
                <button onClick={handleExportCsv} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors shadow-sm border border-gray-200">
                  <Download size={16} /> Export CSV
                </button>
              </div>

              <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
                   <div className="relative flex-1 max-w-md">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                     <input type="text" placeholder="Search logs..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-blue outline-none text-sm font-medium" />
                   </div>
                   <div className="flex items-center gap-2">
                     {(['all', 'auth', 'data', 'system'] as const).map(cat => (
                        <button key={cat} onClick={() => setAuditCategory(cat)} className={cn("px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors border", auditCategory === cat ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}>
                           {cat}
                        </button>
                     ))}
                   </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Timestamp</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">User</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Action</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedAudit.map(entry => (
                        <tr key={entry.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">{entry.user}</td>
                          <td className="px-6 py-4">
                            <span className={cn("px-3 py-1 rounded-lg text-xs font-bold", 
                               entry.category === 'data' ? 'bg-emerald-100 text-emerald-700' : 
                               entry.category === 'auth' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')}>
                               {entry.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{entry.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Privacy' && (
             <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-xl font-bold text-gray-800 mb-8">GDPR Erasure Requests</h2>
               
               <div className="grid gap-6">
                 {erasureRequests.map(req => (
                   <div key={req.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between group hover:border-gray-300 transition-colors">
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-800">{req.patientName}</h4>
                          <p className="text-sm font-medium text-gray-500">ID: {req.patientId} • Requested {new Date(req.requestedAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className={cn("px-4 py-1.5 rounded-xl text-xs font-bold uppercase", req.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')}>
                          {req.status}
                        </span>
                        {req.status === 'pending' && (
                           <button onClick={() => setErasureConfirmId(req.id)} className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-colors">
                             Process Erasure
                           </button>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {(activeTab === 'Notifications' || activeTab === 'Data Sources' || activeTab === 'System') && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-in fade-in">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                 <SettingsIcon size={32} className="text-brand-blue" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{activeTab} Config</h3>
              <p className="text-gray-500 font-medium max-w-sm">This module is currently being updated to the new Clinical Intelligence platform aesthetic.</p>
            </div>
          )}

        </div>
      </div>

      {/* Erasure Confirm Modal */}
      {erasureConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setErasureConfirmId(null)}>
           <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Erasure</h3>
              <p className="text-gray-500 font-medium mb-8">This action is irreversible and permanently deletes patient records across all integrated FHIR systems.</p>
              <div className="flex gap-4">
                <button onClick={() => setErasureConfirmId(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button onClick={() => handleProcessErasure(erasureConfirmId)} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-sm shadow-red-200">Erase Data</button>
              </div>
           </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-5 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-semibold">
           <CheckCircle className="text-emerald-400" size={20} />
           {toast}
        </div>
      )}
    </div>
  );
}
