'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchPatients, createPatient } from '@/lib/api';
import type { Patient as APIPatient } from '@/lib/api';

function calcAge(dob: string | null): number {
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

// ── Toast ──
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-[200] bg-white border rounded-lg px-4 py-3 shadow-lg w-[320px] ${
      type === 'success' ? 'border-l-4 border-l-emerald-500 border-neutral-200' : 'border-l-4 border-l-red-500 border-neutral-200'
    }`}>
      <span className="text-[14px] text-black">{message}</span>
    </div>
  );
}

// ── Add Patient Modal ──
function AddPatientModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: '', dob: '', gender: '', phone: '', govId: '', address: '', source: 'Manual Entry',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'This field is required';
    if (!form.dob) e.dob = 'This field is required';
    if (!form.gender) e.gender = 'This field is required';
    if (!form.phone.trim()) e.phone = 'This field is required';
    if (!form.govId.trim()) e.govId = 'This field is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError('');
    try {
      const parts = form.fullName.trim().split(/\s+/);
      const given = parts[0] ?? '';
      const family = parts.slice(1).join(' ') || given;
      const res = await createPatient({
        given_name: given,
        family_name: family,
        dob: form.dob,
        gender: form.gender.toLowerCase(),
        phone: form.phone,
        gov_id: form.govId || undefined,
        address_line: form.address || undefined,
        source_system: form.source || undefined,
      });
      onCreated(res.id);
    } catch {
      setApiError('Failed to create patient. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string, key: keyof typeof form, type: string = 'text',
    required: boolean = false, placeholder?: string
  ) => (
    <div>
      <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: '' }); }}
        placeholder={placeholder}
        className={`w-full h-10 px-3 rounded-lg border text-[14px] outline-none transition-colors ${
          errors[key] ? 'border-red-400 focus:border-red-500' : 'border-[#E0E0E0] focus:border-black'
        }`}
      />
      {errors[key] && <p className="text-[12px] text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div>
            <h2 className="text-[18px] font-semibold text-black">Add new patient</h2>
            <p className="text-[13px] text-neutral-400 mt-0.5">Create a new patient entry in the registry.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {field('Full name', 'fullName', 'text', true, 'e.g. John Smith')}

          <div className="grid grid-cols-2 gap-4">
            {field('Date of birth', 'dob', 'date', true)}
            <div>
              <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={form.gender}
                onChange={(e) => { setForm({ ...form, gender: e.target.value }); setErrors({ ...errors, gender: '' }); }}
                className={`w-full h-10 px-3 rounded-lg border text-[14px] outline-none bg-white transition-colors ${
                  errors.gender ? 'border-red-400' : 'border-[#E0E0E0] focus:border-black'
                }`}
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <p className="text-[12px] text-red-500 mt-1">{errors.gender}</p>}
            </div>
          </div>

          {field('Phone number', 'phone', 'tel', true, '+1-xxx-xxx-xxxx')}
          {field('National / Government ID', 'govId', 'text', true)}
          {field('Address', 'address', 'text', false, 'Street address (optional)')}

          <div>
            <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">
              Primary source system
            </label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none bg-white focus:border-black transition-colors"
            >
              <option value="Manual Entry">Manual Entry</option>
              <option value="EPIC EHR">EPIC EHR</option>
              <option value="LabCorp">LabCorp</option>
            </select>
          </div>

          {apiError && <p className="text-[13px] text-red-500">{apiError}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-neutral-200 text-[14px] font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-black text-white text-[14px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<APIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'phone' | 'gov'>('name');
  const [searchError, setSearchError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadPatients = () => {
    setLoading(true);
    fetchPatients().then(setPatients).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadPatients(); }, []);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setSearchError('');
    try {
      const apiSearchType = searchType === 'phone' ? 'phone' : searchType === 'gov' ? 'gov' : 'name';
      const results = await fetchPatients(searchId.trim(), apiSearchType);
      if (results.length > 0) {
        router.push(`/patients/${results[0].id}`);
      } else {
        setSearchError('No patient found with this identifier');
      }
    } catch {
      setSearchError('Search failed — check your connection');
    }
  };

  const handlePatientCreated = (id: string) => {
    setModalOpen(false);
    setToast({ message: 'Patient created successfully', type: 'success' });
    loadPatients();
    setTimeout(() => router.push(`/patients/${id}`), 600);
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
      {/* Page title + add button */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-black">Patient Registry</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-[14px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
        >
          <Plus size={16} />
          Add patient
        </button>
      </div>

      {/* Search hero */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            value={searchId}
            onChange={(e) => { setSearchId(e.target.value); setSearchError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search by name, phone number, or government ID..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border-[1.5px] border-[#E0E0E0] text-[14px] outline-none transition-all focus:border-black"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchType('name')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 ${
              searchType === 'name'
                ? 'bg-black text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            Name
          </button>
          <button
            onClick={() => setSearchType('phone')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 ${
              searchType === 'phone'
                ? 'bg-black text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            Phone number
          </button>
          <button
            onClick={() => setSearchType('gov')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 ${
              searchType === 'gov'
                ? 'bg-black text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            Government ID
          </button>
          <button
            onClick={handleSearch}
            className="ml-auto px-6 py-1.5 rounded-full bg-black text-white text-[14px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
          >
            Search patient
          </button>
        </div>
        {searchError && (
          <p className="text-[13px] text-red-500 mt-1">{searchError}</p>
        )}
      </div>

      {/* Patient grid */}
      <div>
        <h2 className="text-[16px] font-semibold text-black mb-4">All patients</h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="skeleton h-[240px] rounded-xl" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white border border-[#EBEBEB] rounded-xl py-16 flex flex-col items-center gap-3">
            <Users size={24} className="text-neutral-300" />
            <p className="text-[13px] text-neutral-400">No patients found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
            {patients.map((p) => {
              const name = titleCase(`${p.given_name ?? ''} ${p.family_name ?? ''}`.trim());
              const age = calcAge(p.dob);
              const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
              const precision = 92;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-[#EBEBEB] rounded-xl p-4 hover:border-[#C8C8C8] hover:-translate-y-0.5 transition-all duration-150 cursor-default group"
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-[14px] font-semibold text-neutral-500">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-black">{name}</h3>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{p.id.slice(0, 8)}...</p>
                    </div>
                    <div className="flex items-center gap-4 text-[13px] text-neutral-500">
                      <span>Age: {age}</span>
                      <span className="capitalize">Gender: {p.gender ?? '—'}</span>
                    </div>
                    <p className="text-[13px] text-neutral-400">
                      {[p.city, p.state].filter(Boolean).join(', ') || '—'}
                    </p>
                    <div className="w-full flex items-center gap-2">
                      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${precision}%` }} />
                      </div>
                      <span className="text-[12px] text-neutral-400">{precision}%</span>
                    </div>
                    <button
                      onClick={() => router.push(`/patients/${p.id}`)}
                      className="text-[13px] text-neutral-500 hover:text-black hover:underline transition-colors pt-1"
                    >
                      View intelligence →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      <AddPatientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handlePatientCreated}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
