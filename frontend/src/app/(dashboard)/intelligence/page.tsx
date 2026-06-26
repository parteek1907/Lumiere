'use client';

import { TrendingUp, AlertTriangle, Database, FileX, Network, ServerCrash } from 'lucide-react';

export default function ClinicalIntelligence() {
  return (
    <div className="w-full max-w-[1400px] mx-auto p-12">
      
      <div className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-clinical-text">Clinical Intelligence</h1>
        <p className="text-clinical-muted mt-2 text-sm">System-wide AI insights on data quality, duplicate trends, and identity risks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Identity Graph (Hero Widget) */}
        <div className="lg:col-span-2 bg-white border border-clinical-border rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
           <div className="flex items-center gap-2 mb-6">
             <Network className="text-clinical-muted" size={18} />
             <h2 className="text-sm font-semibold uppercase tracking-wider text-clinical-muted">Identity Graph Visualization</h2>
           </div>
           
           <div className="flex-1 bg-clinical-bg border border-clinical-border rounded-xl flex items-center justify-center relative overflow-hidden">
              {/* Stylized Mock Graph */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="relative z-10 flex flex-col items-center gap-8">
                 <div className="flex items-center gap-16">
                    <div className="flex flex-col items-center gap-2">
                       <div className="w-12 h-12 bg-white border-2 border-clinical-blue rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-clinical-blue">HOSP A</div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                       <div className="w-12 h-12 bg-white border-2 border-amber-500 rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-amber-500">LAB</div>
                    </div>
                 </div>
                 
                 <div className="w-px h-12 bg-clinical-border relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-clinical-border px-2 py-0.5 rounded text-[10px] text-clinical-muted">Matched</div>
                 </div>
                 
                 <div className="w-20 h-20 bg-clinical-text text-white rounded-2xl shadow-float flex items-center justify-center text-center leading-tight">
                    <span className="text-sm font-bold">Golden<br/>Record</span>
                 </div>
              </div>
           </div>
        </div>

        {/* AI Recommendations */}
        <div className="space-y-6">
           <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <TrendingUp className="text-clinical-blue" size={18} />
               <h2 className="text-sm font-semibold uppercase tracking-wider text-clinical-blue">Duplicate Trends</h2>
             </div>
             <p className="text-sm font-medium text-clinical-text leading-relaxed">
               Patients registered from <strong>General Hospital</strong> have a 24% higher duplicate probability today.
             </p>
             <button className="mt-4 px-4 py-2 bg-white border border-clinical-border rounded-lg text-xs font-medium text-clinical-text hover:bg-gray-50 transition-colors w-full">
               Analyze Root Cause
             </button>
           </div>

           <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <ServerCrash className="text-red-500" size={18} />
               <h2 className="text-sm font-semibold uppercase tracking-wider text-red-500">High Risk Entities</h2>
             </div>
             <p className="text-sm font-medium text-red-900 leading-relaxed">
               City Clinic API is currently dropping 'Phone Number' fields during FHIR transmission.
             </p>
             <button className="mt-4 px-4 py-2 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors w-full">
               View API Logs
             </button>
           </div>
        </div>

        {/* Data Quality Report */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
           
           <div className="bg-white border border-clinical-border rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <Database className="text-clinical-muted" size={16} />
               <h3 className="text-sm font-semibold text-clinical-text">Identity Score Average</h3>
             </div>
             <div className="text-4xl font-bold text-clinical-text mb-2">94.2%</div>
             <p className="text-xs text-emerald-600 font-medium">+1.2% from last week</p>
           </div>

           <div className="bg-white border border-clinical-border rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <FileX className="text-clinical-muted" size={16} />
               <h3 className="text-sm font-semibold text-clinical-text">Missing Information</h3>
             </div>
             <div className="text-4xl font-bold text-clinical-text mb-2">1,204</div>
             <p className="text-xs text-clinical-muted font-medium">Records missing critical identifiers (DOB/Phone)</p>
           </div>

           <div className="bg-white border border-clinical-border rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <AlertTriangle className="text-clinical-muted" size={16} />
               <h3 className="text-sm font-semibold text-clinical-text">Conflicting DOBs</h3>
             </div>
             <div className="text-4xl font-bold text-clinical-text mb-2">86</div>
             <p className="text-xs text-amber-600 font-medium">High risk records requiring immediate review</p>
           </div>
           
        </div>

      </div>
    </div>
  );
}
