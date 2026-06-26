'use client';

import { 
  Search, Bell, MessageCircle, MoreHorizontal, Activity, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Eye, Stethoscope, Heart
} from 'lucide-react';
import { useState } from 'react';

const PATIENTS = [
  { initials: 'SM', name: 'Stacy Mitchell', type: 'Weekly Visit', time: '9:15 AM', color: 'bg-pink-100 text-pink-600' },
  { initials: 'AD', name: 'Amy Dunham', type: 'Routine Checkup', time: '9:30 AM', color: 'bg-blue-100 text-blue-600' },
  { initials: 'DJ', name: 'Demi Joan', type: 'Report', time: '9:50 AM', color: 'bg-emerald-100 text-emerald-600' },
  { initials: 'SM', name: 'Susan Myers', type: 'Weekly Visit', time: '10:15 AM', color: 'bg-pink-100 text-pink-600' },
];

export default function ClinicianDashboard() {
  const [search, setSearch] = useState('');

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
          <MessageCircle className="text-gray-500 hover:text-gray-700 cursor-pointer" />
          <div className="relative">
             <Bell className="text-gray-500 hover:text-gray-700 cursor-pointer" />
             <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 cursor-pointer">
             <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                {/* Placeholder Avatar */}
                <img src="https://i.pravatar.cc/150?img=11" alt="Dr. Kim" className="w-full h-full object-cover" />
             </div>
             <span className="font-semibold text-gray-700 text-sm">Dr. Kim</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,340px] gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Good Morning <span className="text-brand-blue">Dr. Kim!</span>
          </h1>

          {/* Banner: Visits for Today */}
          <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-r from-[#a5f3fc] to-[#bfdbfe] p-8 min-h-[280px] shadow-sm flex flex-col justify-between">
            <div className="relative z-10">
               <h2 className="text-gray-800 font-semibold text-lg mb-1">Visits for Today</h2>
               <div className="text-[5rem] font-bold text-gray-900 leading-none mb-8 tracking-tight">104</div>
               
               <div className="flex gap-4">
                 <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 min-w-[140px] shadow-sm">
                   <p className="text-gray-600 text-sm font-semibold mb-2">New Patients</p>
                   <div className="flex items-end justify-between">
                     <span className="text-3xl font-bold text-gray-800">40</span>
                     <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
                       51% <TrendingUp size={14} className="ml-1" />
                     </span>
                   </div>
                 </div>
                 <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 min-w-[140px] shadow-sm">
                   <p className="text-gray-600 text-sm font-semibold mb-2">Old Patients</p>
                   <div className="flex items-end justify-between">
                     <span className="text-3xl font-bold text-gray-800">64</span>
                     <span className="flex items-center text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded-md">
                       20% <TrendingDown size={14} className="ml-1" />
                     </span>
                   </div>
                 </div>
               </div>
            </div>
            {/* Placeholder for Doctor Image on the right side */}
            <div className="absolute bottom-0 right-0 h-full w-[40%] flex items-end justify-end pointer-events-none">
              <img src="https://i.pravatar.cc/500?img=68" alt="Doctor" className="object-cover h-[110%] object-bottom opacity-90" style={{ mixBlendMode: 'luminosity' }} />
            </div>
          </div>

          {/* Bottom Left Grid: Patient List & Consultation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Patient List */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Patient List</h3>
                <div className="flex items-center text-gray-500 text-sm cursor-pointer hover:text-gray-700">
                   Today <ChevronDown size={16} className="ml-1" />
                </div>
              </div>
              
              <div className="space-y-4">
                {PATIENTS.map((p, i) => (
                  <div key={i} className="flex items-center justify-between group hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${p.color}`}>
                        {p.initials}
                      </div>
                      <div>
                        <p className="text-gray-800 font-bold group-hover:text-brand-blue transition-colors">{p.name}</p>
                        <p className="text-xs text-brand-blue font-medium mt-0.5">{p.type}</p>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-pink-500 bg-pink-100 px-3 py-1.5 rounded-lg">
                      {p.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consultation Card */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Consultation</h3>
              </div>

              <div className="border border-blue-100 rounded-[1.5rem] p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold bg-teal-100 text-teal-700 text-lg">
                      DW
                    </div>
                    <div>
                      <h4 className="text-md font-bold text-gray-800">Denzel White</h4>
                      <p className="text-xs text-gray-400 font-medium">Male - 28 Years 3 Months</p>
                    </div>
                  </div>
                  <MoreHorizontal className="text-gray-300 cursor-pointer hover:text-gray-500" />
                </div>

                <div className="flex justify-between mb-6 border-b border-gray-100 pb-6 px-2">
                  <div className="flex flex-col items-center gap-2">
                    <Activity size={24} className="text-brand-blue" />
                    <span className="text-xs font-bold text-gray-700">Fever</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Stethoscope size={24} className="text-brand-blue" />
                    <span className="text-xs font-bold text-gray-700">Cough</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Heart size={24} className="text-brand-blue" />
                    <span className="text-xs font-bold text-gray-700">Heart Burn</span>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-[80px,1fr] gap-4">
                    <span className="text-gray-800 font-bold">Last Checked</span>
                    <p className="text-gray-500 font-medium">
                      <span className="text-gray-800 font-bold">Dr Everly</span> on 21 April 2026 Prescription <span className="text-brand-blue cursor-pointer hover:underline">#2J9B3KTO</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-[80px,1fr] gap-4">
                    <span className="text-gray-800 font-bold">Observation</span>
                    <p className="text-gray-500 font-medium">High fever and cough at normal hemoglobin levels.</p>
                  </div>
                  <div className="grid grid-cols-[80px,1fr] gap-4">
                    <span className="text-gray-800 font-bold">Prescription</span>
                    <div className="text-gray-500 font-medium space-y-1">
                      <p>Paracetamol - 2 times a day</p>
                      <p>Dizepam - Day and Night before meal</p>
                      <p>Wikoryl</p>
                    </div>
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
                <span>September 2026</span>
                <div className="flex gap-2">
                   <ChevronLeft size={16} className="text-gray-300 cursor-pointer" />
                   <ChevronRight size={16} className="text-gray-400 cursor-pointer" />
                </div>
             </div>

             {/* Mock Calendar Grid */}
             <div className="grid grid-cols-7 text-center gap-y-4 text-xs font-medium">
                <div className="text-gray-400 mb-2">SUN</div>
                <div className="text-gray-400 mb-2">MON</div>
                <div className="text-gray-400 mb-2">TUE</div>
                <div className="text-gray-400 mb-2">WED</div>
                <div className="text-gray-400 mb-2">THU</div>
                <div className="text-gray-400 mb-2">FRI</div>
                <div className="text-gray-400 mb-2">SAT</div>
                
                <div className="text-gray-300"></div>
                <div className="text-gray-300"></div>
                <div className="text-gray-300"></div>
                <div className="text-gray-300"></div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">1</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">2</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">3</div>
                
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">4</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">5</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">6</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">7</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer relative">
                  8
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></div>
                </div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">9</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">10</div>
                
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">11</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">12</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">13</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer relative">
                  14
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></div>
                </div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">15</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">16</div>
                <div className="text-gray-700 hover:text-brand-blue cursor-pointer">17</div>
             </div>
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Upcoming</h3>
                <span className="text-xs font-bold text-brand-blue hover:underline cursor-pointer">View All</span>
             </div>
             <div className="bg-blue-50/50 rounded-2xl p-4 flex gap-4 hover:bg-blue-50 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-2xl bg-blue-400 text-white flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform shadow-sm">
                  M
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Monthly doctor's meet</h4>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">8 Sept, 2026 | 04:00 PM</p>
                </div>
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
                {/* Mock Image Representation */}
                <div className="absolute inset-0 opacity-80" style={{
                  backgroundImage: 'radial-gradient(circle at top right, #0d9488 0%, #14b8a6 100%)'
                }}></div>
                {/* Add a subtle pills abstraction */}
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
