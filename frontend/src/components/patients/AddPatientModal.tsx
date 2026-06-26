'use client';

import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { createPatient, Patient } from '@/lib/api';

export default function AddPatientModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPatient: Patient) => void;
}) {
  const [formData, setFormData] = useState({
    given_name: '',
    family_name: '',
    dob: '',
    gender: 'M',
    phone: '',
    gov_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const patient = await createPatient(formData);
      onSuccess(patient);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-50/50 p-6 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
              <UserPlus size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Add New Patient</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">{error}</div>}
          
          <div className="grid grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name *</label>
              <input 
                required 
                type="text" 
                value={formData.given_name}
                onChange={e => setFormData({ ...formData, given_name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name *</label>
              <input 
                required 
                type="text" 
                value={formData.family_name}
                onChange={e => setFormData({ ...formData, family_name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date of Birth *</label>
              <input 
                required 
                type="date" 
                value={formData.dob}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gender *</label>
              <select 
                required 
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all appearance-none"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-8">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gov / FHIR ID</label>
              <input 
                type="text" 
                value={formData.gov_id}
                onChange={e => setFormData({ ...formData, gov_id: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all"
                placeholder="Optional identifier"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-brand-blue/20 hover:shadow-xl hover:shadow-brand-blue/30 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Creating...' : 'Create Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
