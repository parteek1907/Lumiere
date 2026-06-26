'use client';

import { Users, Sparkles, ShieldCheck, Activity, ArrowRight, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPatients, getDuplicateStats, getGoldenRecordStats, getDuplicates } from '@/lib/api';
import type { Patient, DuplicateCandidate } from '@/lib/api';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function calcAge(dob: string | null): number {
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function ClinicianDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ patients: 0, resolutions: 0, synthesized: 0, queries: '8.4K' });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [topDupes, setTopDupes] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([
    { id: '1', type: 'warning' as const, message: '3 duplicate pairs require manual review before auto-merge deadline', time: '2h ago' },
    { id: '2', type: 'info' as const, message: 'EHR sync completed — 12 new records ingested from EPIC', time: '4h ago' },
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const [pts, dupStats, grStats, dupes] = await Promise.all([
          fetchPatients(),
          getDuplicateStats(),
          getGoldenRecordStats(),
          getDuplicates(0.6),
        ]);
        const totalGR = Object.values(grStats).reduce((a: number, b: number) => a + b, 0);
        setStats({
          patients: pts.length,
          resolutions: dupStats.needs_review,
          synthesized: totalGR,
          queries: '8.4K',
        });
        setPatients(pts.slice(0, 6));
        setTopDupes(dupes.slice(0, 5));
      } catch (e) {
        console.error('Stats fetch failed', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    { label: 'Patients', value: stats.patients, change: '+2.4%', positive: true, icon: Users },
    { label: 'Resolutions', value: stats.resolutions, change: '+12.5%', positive: true, icon: Sparkles },
    { label: 'Synthesized', value: stats.synthesized, change: '+1.2%', positive: true, icon: ShieldCheck },
    { label: 'Core Queries', value: stats.queries, change: '+5.7%', positive: true, icon: Activity },
  ];

  const dismissAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
        <div className="space-y-2">
          <div className="skeleton h-7 w-64" />
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[120px] rounded-xl" />)}
        </div>
        <div className="skeleton h-[300px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-black">
            {getGreeting()}, Dr. Parteek.
          </h1>
          <p className="text-[13px] text-neutral-500 mt-1">{formatDate()}</p>
        </div>
        
        {/* Lumiere Quick Search */}
        <div className="flex-1 max-w-md w-full">
           <div className="relative group">
              <div className="absolute inset-0 bg-black/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
              <div className="relative flex items-center bg-white border border-[#EBEBEB] rounded-xl px-4 py-2 hover:border-[#C8C8C8] transition-all">
                 <input 
                   type="text" 
                   placeholder="Ask Lumiere (name, phone...)"
                   className="bg-transparent border-none outline-none text-[13px] font-medium w-full text-black placeholder-neutral-400"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       router.push(`/query?q=${encodeURIComponent(e.currentTarget.value)}`);
                     }
                   }}
                 />
                 <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-neutral-100 rounded text-[9px] font-bold text-neutral-400 uppercase tracking-widest border border-black/5">
                    Search
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white border border-[#EBEBEB] rounded-xl p-4 hover:border-[#C8C8C8] hover:-translate-y-0.5 transition-all duration-150 cursor-default"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={16} className="text-neutral-400" />
                <span className={`text-[11px] font-medium ${s.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {s.change}
                </span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">{s.label}</p>
              <p className="text-[28px] font-bold text-black leading-tight">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Today's Patients */}
      <div>
        <h2 className="text-[16px] font-semibold text-black mb-4">Today&apos;s patients</h2>
        {patients.length === 0 ? (
          <div className="bg-white border border-[#EBEBEB] rounded-xl py-16 flex flex-col items-center gap-3">
            <Users size={24} className="text-neutral-300" />
            <p className="text-[13px] text-neutral-400">No patients scheduled today</p>
          </div>
        ) : (
          <div className="bg-white border border-[#EBEBEB] rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Name</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Age</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Gender</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Last sync</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Precision</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors duration-100">
                    <td className="px-4 py-3">
                      <span className="text-[14px] font-medium text-black">
                        {`${p.given_name ?? ''} ${p.family_name ?? ''}`.trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[14px] text-neutral-600">{calcAge(p.dob)}</td>
                    <td className="px-4 py-3 text-[14px] text-neutral-600 capitalize">{p.gender ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-neutral-400">{new Date(p.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
                        </div>
                        <span className="text-[13px] text-neutral-500">92%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/patients/${p.id}`)}
                        className="text-[13px] font-medium text-neutral-500 border border-neutral-200 rounded-lg px-3 py-1.5 hover:border-[#C8C8C8] hover:text-black transition-all duration-150"
                      >
                        View record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Review */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[16px] font-semibold text-black">Pending review</h2>
          <span className="text-[11px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
            {topDupes.length}
          </span>
        </div>
        <div className="bg-white border border-[#EBEBEB] rounded-xl divide-y divide-neutral-50">
          {topDupes.map((d) => {
            const nameA = `${d.record_a?.given_name ?? ''} ${d.record_a?.family_name ?? ''}`.trim();
            const nameB = `${d.record_b?.given_name ?? ''} ${d.record_b?.family_name ?? ''}`.trim();
            const score = Math.round((d.composite_score ?? 0) * 100);
            return (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors duration-100">
                <div className="flex items-center gap-2 text-[14px]">
                  <span className="font-medium text-black">{nameA}</span>
                  <ArrowRight size={14} className="text-neutral-300" />
                  <span className="font-medium text-black">{nameB}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[13px] text-neutral-500">{score}%</span>
                  <button
                    onClick={() => router.push('/matches')}
                    className="text-[13px] font-medium text-black hover:underline"
                  >
                    Review
                  </button>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 text-right">
            <button
              onClick={() => router.push('/matches')}
              className="text-[13px] font-medium text-neutral-500 hover:text-black transition-colors"
            >
              View all →
            </button>
          </div>
        </div>
      </div>

      {/* Platform Performance */}
      <div>
        <h2 className="text-[16px] font-semibold text-black mb-4">Platform performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Avg. resolution time', value: '1.4s', sub: 'Last 24h', color: 'text-emerald-600' },
            { label: 'Ingestion throughput', value: '342/hr', sub: 'Records per hour', color: 'text-blue-600' },
            { label: 'FHIR compliance', value: '97.2%', sub: 'R4 valid records', color: 'text-emerald-600' },
            { label: 'API uptime', value: '99.98%', sub: 'Last 30 days', color: 'text-emerald-600' },
          ].map(m => (
            <div key={m.label} className="bg-white border border-[#EBEBEB] rounded-xl p-4 hover:border-[#C8C8C8] transition-all duration-150">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">{m.label}</p>
              <p className={`text-[24px] font-bold ${m.color} leading-tight mt-1`}>{m.value}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{m.sub}</p>
            </div>
          ))}
        </div>
        {/* Source system breakdown */}
        <div className="bg-white border border-[#EBEBEB] rounded-xl p-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-3">Source system breakdown</p>
          <div className="space-y-3">
            {[
              { name: 'EPIC EHR', records: 412, latency: '0.8s', status: 'healthy' as const },
              { name: 'LabCorp', records: 187, latency: '1.2s', status: 'healthy' as const },
              { name: 'PDF Archive', records: 56, latency: '2.1s', status: 'degraded' as const },
              { name: 'Manual Entry', records: 45, latency: '—', status: 'healthy' as const },
            ].map(s => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${s.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-[14px] text-black">{s.name}</span>
                </div>
                <div className="flex items-center gap-6 text-[13px]">
                  <span className="text-neutral-500">{s.records} records</span>
                  <span className="text-neutral-400 w-12 text-right">{s.latency}</span>
                  <span className={`text-[11px] font-medium ${s.status === 'healthy' ? 'text-emerald-600' : 'text-amber-600'} capitalize`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Health + Intelligence Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
        {/* System Health */}
        <div>
          <h2 className="text-[16px] font-semibold text-black mb-4">System health</h2>
          <div className="bg-white border border-[#EBEBEB] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Precision Core', status: 'Operational', color: 'bg-emerald-500' },
                { label: 'EHR Sync', status: 'Operational', color: 'bg-emerald-500' },
                { label: 'AI Engine', status: 'Operational', color: 'bg-emerald-500' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-lg">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                  <span className="text-[13px] text-neutral-700">{s.label}</span>
                  <span className="text-[12px] text-neutral-400">{s.status}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-neutral-400">Last sync: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Intelligence Alerts */}
        <div>
          <h2 className="text-[16px] font-semibold text-black mb-4">Intelligence alerts</h2>
          {alerts.length === 0 ? (
            <div className="bg-white border border-[#EBEBEB] rounded-xl py-12 flex flex-col items-center gap-2">
              <Info size={20} className="text-neutral-300" />
              <p className="text-[13px] text-neutral-400">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 ${
                    a.type === 'warning' ? 'border-amber-200' : 'border-[#EBEBEB]'
                  }`}
                >
                  {a.type === 'warning' ? (
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-black">{a.message}</p>
                    <p className="text-[12px] text-neutral-400 mt-1">{a.time}</p>
                  </div>
                  <button
                    onClick={() => dismissAlert(a.id)}
                    className="text-neutral-300 hover:text-black transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
