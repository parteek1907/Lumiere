'use client';

import { Search, Filter, ShieldCheck, Clock, FileText, User, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { fetchPatients, Patient } from '@/lib/api';
import AddPatientModal from '@/components/patients/AddPatientModal';
import { useRouter } from 'next/navigation';

export default function PatientRegistry() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadPatients();
  }, [search]);

  const loadPatients = async () => {
    try {
      const data = await fetchPatients(search);
      setPatients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string | null | undefined) => {
    if (!dob) return 'Unknown';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const getInitials = (given: string | null | undefined, family: string | null | undefined) => {
    return `${given?.charAt(0) || ''}${family?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-12">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-clinical-text">Patient Registry</h1>
          <p className="text-clinical-muted mt-2 text-sm">Manage and review all registered patients across the network.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-clinical-border rounded-lg text-sm font-medium text-clinical-text hover:bg-gray-50 transition-colors shadow-sm">
             <Filter size={16} /> Filters
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue border border-brand-blue rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
             <Plus size={16} /> Add New Patient
          </button>
        </div>
      </div>

      <div className="mb-8 relative max-w-2xl">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-clinical-muted" size={18} />
         <input 
           type="text"
           className="w-full pl-11 pr-4 py-3 bg-white border border-clinical-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm"
           placeholder="Search by Name, Phone, or Medical Record Number..."
           value={search}
           onChange={(e) => setSearch(e.target.value)}
         />
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-clinical-muted">Loading patients...</div>
      ) : patients.length === 0 ? (
        <div className="flex justify-center p-12 text-clinical-muted">No patients found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient, index) => (
            <div key={patient.id} className="bg-white border border-clinical-border rounded-2xl p-6 shadow-sm hover:shadow-float transition-shadow group flex flex-col h-full cursor-pointer" onClick={() => router.push(`/patients/${patient.id}`)}>
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg ${index % 2 === 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                     {getInitials(patient.given_name, patient.family_name)}
                   </div>
                   <div>
                     <h3 className="font-semibold text-clinical-text text-lg">{patient.given_name} {patient.family_name}</h3>
                     <p className="text-xs text-clinical-muted">{calculateAge(patient.dob)} years old • {patient.gender}</p>
                   </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                    <ShieldCheck size={12} /> Verified
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                <div>
                  <p className="text-xs text-clinical-muted font-medium mb-1">FHIR ID / Gov ID</p>
                  <p className="font-medium text-clinical-text font-mono text-xs truncate" title={patient.fhir_id || patient.id}>{patient.fhir_id || patient.id.split('-')[0]}</p>
                </div>
                <div>
                  <p className="text-xs text-clinical-muted font-medium mb-1">Phone</p>
                  <p className="font-medium text-clinical-text">{patient.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                   <p className="text-xs text-clinical-muted font-medium mb-1">Location</p>
                   <p className="font-medium text-clinical-text">{patient.city ? `${patient.city}, ${patient.state}` : 'N/A'}</p>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-clinical-border grid grid-cols-3 gap-2">
                <Link href={`/patients/${patient.id}`} onClick={(e) => e.stopPropagation()} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-clinical-text transition-colors">
                  <User size={16} className="text-clinical-muted group-hover:text-brand-blue transition-colors" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Profile</span>
                </Link>
                <button className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-clinical-text transition-colors">
                  <Clock size={16} className="text-clinical-muted" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Timeline</span>
                </button>
                <button className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 text-clinical-text transition-colors">
                  <FileText size={16} className="text-clinical-muted" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Identity</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPatientModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={(newPatient) => {
          // Add to start of list
          setPatients([newPatient, ...patients]);
        }} 
      />
    </div>
  );
}
