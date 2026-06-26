'use client';

import { Check, X, UserCog, ArrowRight, ShieldAlert, Smartphone, Search } from 'lucide-react';


export default function IdentityResolution() {
  return (
    <div className="w-full max-w-[1400px] mx-auto p-12">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-clinical-text">Identity Resolution</h1>
          <p className="text-clinical-muted mt-2 text-sm">Review AI-detected duplicate records and resolve identity conflicts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-clinical-text text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm">
             Auto-Resolve Eligible (12)
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar List */}
        <div className="w-80 flex-shrink-0 space-y-3">
           <div className="relative mb-4">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-muted" size={16} />
             <input type="text" placeholder="Search queue..." className="w-full pl-9 pr-3 py-2 bg-white border border-clinical-border rounded-lg text-sm outline-none focus:border-clinical-blue" />
           </div>

           {/* Active Item */}
           <div className="bg-white border-2 border-clinical-blue rounded-xl p-4 shadow-sm cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-clinical-blue"></div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-clinical-blue">97% Match</span>
                <span className="text-xs text-clinical-muted">2 mins ago</span>
              </div>
              <h3 className="font-semibold text-clinical-text text-sm mb-1">Eleanor Vance</h3>
              <p className="text-xs text-clinical-muted">Conflict: Phone & Hospital mismatch</p>
           </div>

           {/* Inactive Items */}
           <div className="bg-white border border-transparent hover:border-clinical-border rounded-xl p-4 cursor-pointer transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-emerald-600">99% Match</span>
                <span className="text-xs text-clinical-muted">1 hr ago</span>
              </div>
              <h3 className="font-semibold text-clinical-text text-sm mb-1">Michael Chen</h3>
              <p className="text-xs text-clinical-muted">Conflict: Address typography</p>
           </div>
        </div>

        {/* Main Comparison Area */}
        <div className="flex-1 bg-white border border-clinical-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
           
           <div className="p-6 border-b border-clinical-border bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <ShieldAlert className="text-amber-500" />
                 <div>
                   <h2 className="text-lg font-semibold text-clinical-text">High Confidence Duplicate Detected</h2>
                   <p className="text-xs text-clinical-muted mt-0.5">AI suggests merging Record B into Golden Record A.</p>
                 </div>
              </div>
              <div className="text-right">
                 <div className="text-2xl font-bold text-clinical-text">97%</div>
                 <div className="text-[10px] font-semibold uppercase tracking-widest text-clinical-muted">Overall Confidence</div>
              </div>
           </div>

           <div className="flex-1 p-8">
              
              {/* Columns Header */}
              <div className="grid grid-cols-[1fr,120px,1fr] gap-8 mb-8 text-sm font-semibold text-clinical-muted uppercase tracking-wider text-center">
                 <div className="text-left text-clinical-text">Record A (Golden)</div>
                 <div>AI Analysis</div>
                 <div className="text-right text-clinical-text">Record B (Incoming)</div>
              </div>

              <div className="space-y-6">
                 
                 {/* Row 1: Name */}
                 <div className="grid grid-cols-[1fr,120px,1fr] gap-8 items-center">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                       <p className="text-xs text-clinical-muted mb-1">Full Name</p>
                       <p className="font-medium text-clinical-text">Eleanor Vance</p>
                    </div>
                    <div className="text-center flex flex-col items-center">
                       <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md mb-1">91%</span>
                       <ArrowRight className="text-gray-300" size={16} />
                    </div>
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-right">
                       <p className="text-xs text-red-400 mb-1">Full Name</p>
                       <p className="font-medium text-red-900">Eleonor Vance</p>
                    </div>
                 </div>

                 {/* Row 2: DOB */}
                 <div className="grid grid-cols-[1fr,120px,1fr] gap-8 items-center">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                       <p className="text-xs text-clinical-muted mb-1">Date of Birth</p>
                       <p className="font-medium text-clinical-text font-mono">1982-04-12</p>
                    </div>
                    <div className="text-center flex flex-col items-center">
                       <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1">100%</span>
                       <ArrowRight className="text-emerald-300" size={16} />
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-right">
                       <p className="text-xs text-clinical-muted mb-1">Date of Birth</p>
                       <p className="font-medium text-clinical-text font-mono">1982-04-12</p>
                    </div>
                 </div>

                 {/* Row 3: Phone */}
                 <div className="grid grid-cols-[1fr,120px,1fr] gap-8 items-center">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                       <Smartphone size={16} className="text-clinical-muted" />
                       <div>
                         <p className="text-xs text-clinical-muted mb-1">Phone</p>
                         <p className="font-medium text-clinical-text font-mono">+1 (555) 019-2831</p>
                       </div>
                    </div>
                    <div className="text-center flex flex-col items-center">
                       <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1">100%</span>
                       <ArrowRight className="text-emerald-300" size={16} />
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-end gap-3 text-right">
                       <div>
                         <p className="text-xs text-clinical-muted mb-1">Phone</p>
                         <p className="font-medium text-clinical-text font-mono">+1 (555) 019-2831</p>
                       </div>
                       <Smartphone size={16} className="text-clinical-muted" />
                    </div>
                 </div>

                 {/* Row 4: Address */}
                 <div className="grid grid-cols-[1fr,120px,1fr] gap-8 items-center">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                       <p className="text-xs text-clinical-muted mb-1">Address</p>
                       <p className="font-medium text-clinical-text">412 Medical Center Blvd, Suite 200</p>
                    </div>
                    <div className="text-center flex flex-col items-center">
                       <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1">96%</span>
                       <ArrowRight className="text-emerald-300" size={16} />
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-right">
                       <p className="text-xs text-clinical-muted mb-1">Address</p>
                       <p className="font-medium text-clinical-text">412 Med Center Blvd, Ste 200</p>
                    </div>
                 </div>

              </div>
           </div>

           {/* Action Footer */}
           <div className="p-6 border-t border-clinical-border bg-gray-50 flex items-center justify-end gap-4">
              <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-clinical-border text-clinical-text rounded-lg font-medium text-sm shadow-sm hover:bg-gray-50 transition-colors">
                 <UserCog size={16} />
                 Manual Review
              </button>
              <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg font-medium text-sm shadow-sm hover:bg-red-50 transition-colors">
                 <X size={16} />
                 Reject Match
              </button>
              <button className="flex items-center gap-2 px-6 py-2.5 bg-clinical-text text-white rounded-lg font-medium text-sm shadow-sm hover:bg-gray-800 transition-colors">
                 <Check size={16} />
                 Approve Merge
              </button>
           </div>
           
        </div>
      </div>
    </div>
  );
}
