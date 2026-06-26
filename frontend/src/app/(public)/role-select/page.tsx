'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RoleSelectPage() {
  const router = useRouter();

  useEffect(() => {
    const isComplete = localStorage.getItem('onboardingComplete');
    if (isComplete === 'true') {
      router.push('/dashboard');
    }
  }, [router]);

  const handleRoleSelect = (role: 'doctor' | 'patient') => {
    localStorage.setItem('role', role);
    const isComplete = localStorage.getItem('onboardingComplete');
    if (isComplete === 'true') {
      router.push('/dashboard');
    } else {
      router.push('/complete-profile');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-white px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-2xl w-full space-y-12"
      >
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tightest text-black">
            Who is logging in?
          </h1>
          <p className="text-neutral-500 font-medium text-lg">
            Select your role to access the appropriate dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doctor Option */}
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRoleSelect('doctor')}
            className="group relative p-8 rounded-[32px] bg-white border-2 border-neutral-100 hover:border-black text-left flex flex-col items-center text-center space-y-6 transition-colors duration-300 shadow-sm hover:shadow-2xl"
          >
            <div className="w-20 h-20 rounded-full bg-neutral-50 group-hover:bg-black flex items-center justify-center transition-colors duration-300">
              <Stethoscope className="w-10 h-10 text-black group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-black tracking-tight">Clinician</h3>
              <p className="text-neutral-500 font-medium">Full access to patient records, matches, and clinical queries.</p>
            </div>
          </motion.button>

          {/* Patient Option */}
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRoleSelect('patient')}
            className="group relative p-8 rounded-[32px] bg-white border-2 border-neutral-100 hover:border-black text-left flex flex-col items-center text-center space-y-6 transition-colors duration-300 shadow-sm hover:shadow-2xl"
          >
            <div className="w-20 h-20 rounded-full bg-neutral-50 group-hover:bg-black flex items-center justify-center transition-colors duration-300">
              <UserCircle className="w-10 h-10 text-black group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-black tracking-tight">Patient</h3>
              <p className="text-neutral-500 font-medium">Access your unified Golden Record and ask questions about your health data.</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
