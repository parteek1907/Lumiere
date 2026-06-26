'use client';

import { Search, GitMerge, XCircle, RefreshCw, Trash2, Filter } from 'lucide-react';

const AUDIT_LOGS = [
  { id: 'AL-9021', time: 'Today, 09:05 AM', doctor: 'Dr. Kim', action: 'MERGE', reason: 'High confidence lab result match', conf: '97%', icon: GitMerge, color: 'text-clinical-blue bg-blue-50' },
  { id: 'AL-9020', time: 'Today, 08:42 AM', doctor: 'Dr. Everly', action: 'REJECT', reason: 'Differing SSN recorded', conf: '81%', icon: XCircle, color: 'text-red-500 bg-red-50' },
  { id: 'AL-9019', time: 'Yesterday, 14:30 PM', doctor: 'System', action: 'UPDATE', reason: 'FHIR webhook sync from General Hospital', conf: '-', icon: RefreshCw, color: 'text-emerald-500 bg-emerald-50' },
  { id: 'AL-9018', time: 'Yesterday, 11:15 AM', doctor: 'Admin', action: 'DELETE', reason: 'Test record cleanup', conf: '-', icon: Trash2, color: 'text-gray-500 bg-gray-100' },
];

export default function AuditTrail() {
  return (
    <div className="w-full max-w-[1400px] mx-auto p-12">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-clinical-text">Audit Trail</h1>
          <p className="text-clinical-muted mt-2 text-sm">Immutable ledger of all identity resolutions and data modifications.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-clinical-border rounded-lg text-sm font-medium text-clinical-text hover:bg-gray-50 transition-colors shadow-sm">
             <Filter size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="bg-white border border-clinical-border rounded-2xl shadow-sm overflow-hidden">
         
         {/* Search Toolbar */}
         <div className="p-4 border-b border-clinical-border bg-gray-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-muted" size={16} />
               <input type="text" placeholder="Search logs by ID, Doctor, or Reason..." className="w-full pl-9 pr-3 py-2 bg-white border border-clinical-border rounded-lg text-sm outline-none focus:border-clinical-blue" />
            </div>
         </div>

         {/* Log Table Header */}
         <div className="grid grid-cols-[80px,180px,140px,120px,1fr,100px] gap-4 p-4 border-b border-clinical-border text-xs font-semibold uppercase tracking-wider text-clinical-muted bg-white">
            <div>Log ID</div>
            <div>Timestamp</div>
            <div>Actor</div>
            <div>Action</div>
            <div>Reason / Details</div>
            <div className="text-right">Confidence</div>
         </div>

         {/* Log Entries */}
         <div className="divide-y divide-clinical-border">
            {AUDIT_LOGS.map((log) => {
               const Icon = log.icon;
               return (
                 <div key={log.id} className="grid grid-cols-[80px,180px,140px,120px,1fr,100px] gap-4 p-4 items-center hover:bg-gray-50 transition-colors text-sm">
                    <div className="font-mono text-xs text-clinical-muted">{log.id}</div>
                    <div className="text-clinical-text font-medium">{log.time}</div>
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                         {log.doctor.substring(0,2).toUpperCase()}
                       </div>
                       <span className="text-clinical-text font-medium">{log.doctor}</span>
                    </div>
                    <div>
                       <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${log.color}`}>
                         <Icon size={12} /> {log.action}
                       </span>
                    </div>
                    <div className="text-clinical-muted truncate pr-4">{log.reason}</div>
                    <div className="text-right font-semibold text-clinical-text">{log.conf}</div>
                 </div>
               );
            })}
         </div>

         {/* Pagination Footer */}
         <div className="p-4 border-t border-clinical-border bg-gray-50 flex items-center justify-between text-xs text-clinical-muted font-medium">
            <span>Showing 4 of 24,192 entries</span>
            <div className="flex items-center gap-2">
               <button className="px-3 py-1 bg-white border border-clinical-border rounded hover:bg-gray-100 disabled:opacity-50" disabled>Previous</button>
               <button className="px-3 py-1 bg-white border border-clinical-border rounded hover:bg-gray-100">Next</button>
            </div>
         </div>

      </div>
    </div>
  );
}
