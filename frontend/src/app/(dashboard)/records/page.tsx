'use client';

import { FileText, Clock, ShieldCheck, Activity, Pill, FlaskConical, Stethoscope } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getGoldenRecord } from '@/lib/api';

const FALLBACK_VISITS = [
  {
    type: 'General Check-up',
    provider: 'City Hospital — Dr. Aisha Patel',
    date: '2026-03-18',
    tag: 'Verified',
  },
  {
    type: 'Blood Panel & Lab Results',
    provider: 'City Hospital — Lab Services',
    date: '2026-03-18',
    tag: 'Verified',
  },
  {
    type: 'Cardiology Consultation',
    provider: 'City Hospital — Dr. Marcus Webb',
    date: '2025-11-04',
    tag: 'Verified',
  },
];

const RECENT_ACTIVITY = [
  {
    icon: 'stethoscope',
    title: 'Discharge summary uploaded',
    detail: 'City Hospital · General Check-up on 18 Mar 2026',
    time: '2 days ago',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: 'flask',
    title: 'Lab results available',
    detail: 'City Hospital · Blood Panel — HbA1c, CBC, Lipid profile',
    time: '2 days ago',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: 'pill',
    title: 'Prescription issued',
    detail: 'City Hospital · Dr. Aisha Patel — Atorvastatin 10 mg',
    time: '2 days ago',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: 'stethoscope',
    title: 'Cardiology follow-up scheduled',
    detail: 'City Hospital · Dr. Marcus Webb — 15 May 2026',
    time: '5 months ago',
    color: 'text-emerald-600 bg-emerald-50',
  },
];

const iconMap: Record<string, React.ReactNode> = {
  stethoscope: <Stethoscope size={15} />,
  flask: <FlaskConical size={15} />,
  pill: <Pill size={15} />,
};

export default function RecordsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const record = await getGoldenRecord('patient-1'); 
        setData(record);
      } catch (e) {
        console.error('Failed to load patient record', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
        <div className="skeleton h-[300px] rounded-xl" />
      </div>
    );
  }

  const visits = data?.visits?.length ? data.visits : FALLBACK_VISITS;

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-black">My Records</h1>
        <p className="text-[13px] text-neutral-500 mt-1">Access your consolidated medical history, labs, and documents.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-[#EBEBEB] rounded-xl divide-y divide-neutral-50">
          {visits.map((v: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-6 py-5 hover:bg-neutral-50 transition-colors duration-100">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-neutral-100/80 text-black">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-black">{v.type}</h3>
                  <p className="text-[13px] text-neutral-500 mt-0.5">{v.provider}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {v.tag && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    <ShieldCheck size={11} />
                    {v.tag}
                  </span>
                )}
                <span className="text-[13px] text-neutral-400 flex items-center gap-1.5">
                  <Clock size={14} />
                  {new Date(v.date).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={15} className="text-neutral-400" />
          <h2 className="text-[14px] font-semibold text-black">Recent Activity</h2>
        </div>
        <div className="bg-white border border-[#EBEBEB] rounded-xl divide-y divide-neutral-50">
          {RECENT_ACTIVITY.map((item, i) => (
            <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors duration-100">
              <div className={`mt-0.5 p-2 rounded-lg ${item.color}`}>
                {iconMap[item.icon]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-black">{item.title}</p>
                <p className="text-[12px] text-neutral-500 mt-0.5 truncate">{item.detail}</p>
              </div>
              <span className="text-[12px] text-neutral-400 whitespace-nowrap flex items-center gap-1.5 mt-0.5">
                <Clock size={12} />
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
