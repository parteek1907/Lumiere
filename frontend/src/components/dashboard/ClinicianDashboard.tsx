'use client';

import { 
  Search, Bell, MessageCircle, MoreHorizontal, Activity, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Eye, Stethoscope, Heart, AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchAppointments, getDuplicates, Appointment, DuplicateCandidate } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ClinicianDashboard() {
  const [search, setSearch] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const [appts, dups] = await Promise.all([
          fetchAppointments(),
          getDuplicates()
        ]);
        setAppointments(appts);
        setDuplicates(dups);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getInitials = (given?: string | null, family?: string | null) => {
    return `${given?.charAt(0) || ''}${family?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  // Get appointments for the current month
  const today = new Date();
  const currentMonthAppts = appointments.filter(a => {
    if (!a.appointment_date) return false;
    const d = new Date(a.appointment_date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(today.getFullYear(), today.getMonth());
  const firstDay = getFirstDayOfMonth(today.getFullYear(), today.getMonth());

  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum > 0 && dayNum <= daysInMonth) return dayNum;
    return null;
  });

  const hasAppointment = (day: number) => {
    return currentMonthAppts.some(a => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      // Depending on timezone, this could be off by one, but for simple visualization:
      return parseInt(a.appointment_date.split('-')[2]) === day;
    });
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500 pt-6 px-6">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full bg-gray-100 text-gray-700 placeholder-gray-400 rounded-xl py-2.5 pl-10 pr-4 outline-none border-none focus:ring-2 focus:ring-brand-blue/20 transition-all"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-6">
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,340px] gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Good Morning <span className="text-brand-blue">Dr. Kim!</span>
          </h1>

          {/* Banner: Today's Focus */}
          <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-r from-[#a5f3fc] to-[#bfdbfe] p-8 min-h-[280px] shadow-sm flex flex-col justify-between">
            <div className="relative z-10">
               <h2 className="text-gray-800 font-semibold text-lg mb-1">Today's Focus</h2>
               <div className="text-[5rem] font-bold text-gray-900 leading-none mb-8 tracking-tight">{loading ? '...' : (duplicates.length + currentMonthAppts.length)}</div>
               
               <div className="flex gap-4">
                 <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 min-w-[140px] shadow-sm">
                   <p className="text-gray-600 text-sm font-semibold mb-2">Duplicate Records</p>
                   <div className="flex items-end justify-between">
                     <span className="text-3xl font-bold text-gray-800">{loading ? '-' : duplicates.length}</span>
                     <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md">
                       Needs Review
                     </span>
                   </div>
                 </div>
                 <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 min-w-[140px] shadow-sm">
                   <p className="text-gray-600 text-sm font-semibold mb-2">Appointments</p>
                   <div className="flex items-end justify-between">
                     <span className="text-3xl font-bold text-gray-800">{loading ? '-' : currentMonthAppts.length}</span>
                     <span className="flex items-center text-xs font-bold text-blue-500 bg-blue-100 px-2 py-1 rounded-md">
                       This Month
                     </span>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Bottom Left Grid: Patient List & Consultation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Pending Reviews */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Pending Reviews</h3>
                <div className="flex items-center text-gray-500 text-sm cursor-pointer hover:text-gray-700">
                   Today <ChevronDown size={16} className="ml-1" />
                </div>
              </div>
              
              <div className="space-y-4">
                {loading ? (
                  <p className="text-sm text-gray-400">Loading duplicates...</p>
                ) : duplicates.length === 0 ? (
                  <p className="text-sm text-gray-400">No pending reviews found.</p>
                ) : (
                  duplicates.slice(0, 4).map((dup, i) => (
                    <div 
                      key={dup.id} 
                      onClick={() => router.push(`/resolution`)}
                      className="flex items-center justify-between group hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${i % 2 === 0 ? 'bg-amber-100 text-amber-600' : 'bg-pink-100 text-pink-600'}`}>
                          {getInitials(dup.record_a?.given_name, dup.record_a?.family_name)}
                        </div>
                        <div>
                          <p className="text-gray-800 font-bold group-hover:text-brand-blue transition-colors">
                            {dup.record_a?.given_name} {dup.record_a?.family_name}
                          </p>
                          <p className="text-xs text-brand-blue font-medium mt-0.5">Duplicate Candidate</p>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1.5 rounded-lg">
                        {Math.round((dup.composite_score || 0) * 100)}% Match
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
              </div>

              <div className="border border-blue-100 rounded-[1.5rem] p-5 relative overflow-hidden">
                <div className="relative border-l-2 border-gray-100 ml-2 space-y-6">
                  
                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1"></div>
                    <p className="text-xs text-gray-400 font-bold mb-1">08:20 AM</p>
                    <p className="text-sm font-bold text-gray-800">Patient Registered</p>
                    <p className="text-xs text-brand-blue font-medium mt-1">General Hospital</p>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-amber-400 rounded-full -left-[7px] top-1"></div>
                    <p className="text-xs text-gray-400 font-bold mb-1">08:21 AM</p>
                    <p className="text-sm font-bold text-gray-800">Duplicate Detected</p>
                    <p className="text-xs text-brand-blue font-medium mt-1">Flagged for manual review.</p>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-brand-blue rounded-full -left-[7px] top-1"></div>
                    <p className="text-xs text-gray-400 font-bold mb-1">09:05 AM</p>
                    <p className="text-sm font-bold text-gray-800">Doctor Approved Merge</p>
                    <p className="text-xs text-brand-blue font-medium mt-1">Golden Record Updated.</p>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Calendar */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Calendar</h3>
                <ChevronDown className="text-gray-400" size={16} />
             </div>
             
             <div className="flex items-center justify-between mb-6 text-sm font-semibold text-gray-700">
                <span>{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <div className="flex gap-2">
                   <ChevronLeft size={16} className="text-gray-300 cursor-pointer" />
                   <ChevronRight size={16} className="text-gray-400 cursor-pointer" />
                </div>
             </div>

             {/* Live Calendar Grid */}
             <div className="grid grid-cols-7 text-center gap-y-4 text-xs font-medium">
                <div className="text-gray-400 mb-2">SUN</div>
                <div className="text-gray-400 mb-2">MON</div>
                <div className="text-gray-400 mb-2">TUE</div>
                <div className="text-gray-400 mb-2">WED</div>
                <div className="text-gray-400 mb-2">THU</div>
                <div className="text-gray-400 mb-2">FRI</div>
                <div className="text-gray-400 mb-2">SAT</div>
                
                {days.map((day, idx) => (
                  <div key={idx} className={`text-gray-700 hover:text-brand-blue cursor-pointer relative ${!day ? 'invisible' : ''}`}>
                    {day}
                    {day && hasAppointment(day) && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-brand-blue rounded-full shadow-sm"></div>
                    )}
                  </div>
                ))}
             </div>
             
             {/* List of upcoming appointments */}
             <div className="mt-8 space-y-3">
               {loading ? (
                 <p className="text-xs text-gray-400 text-center">Loading...</p>
               ) : currentMonthAppts.length === 0 ? (
                 <p className="text-xs text-gray-400 text-center">No appointments scheduled.</p>
               ) : (
                 currentMonthAppts.slice(0, 3).map(appt => (
                   <div key={appt.id} className="bg-gray-50 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => router.push(`/patients/${appt.patient_id}`)}>
                     <div>
                       <p className="text-sm font-bold text-gray-800">{appt.title || 'Consultation'}</p>
                       <p className="text-[11px] text-gray-500 font-medium mt-0.5">{appt.appointment_date} {appt.appointment_time}</p>
                     </div>
                     <div className="text-[10px] font-bold text-white bg-brand-blue px-2 py-1 rounded-md shadow-sm">
                       {appt.status}
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>

          {/* Daily Read */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group cursor-pointer">
             <div className="flex items-center gap-2 mb-3">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Daily Read</span>
             </div>
             
             <h4 className="text-sm font-bold text-gray-800 leading-snug mb-4 group-hover:text-brand-blue transition-colors">
               Equitable medical education with efforts toward real change
             </h4>
             
             <div className="h-32 bg-teal-500 rounded-2xl overflow-hidden relative">
                <div className="absolute inset-0 opacity-80" style={{
                  backgroundImage: 'radial-gradient(circle at top right, #0d9488 0%, #14b8a6 100%)'
                }}></div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                   <div className="w-8 h-4 rounded-full bg-orange-400 shadow-sm border border-orange-300 rotate-45"></div>
                   <div className="w-8 h-4 rounded-full bg-white/80 shadow-sm border border-white/50 -rotate-12"></div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
