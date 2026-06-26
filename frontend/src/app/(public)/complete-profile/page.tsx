'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Phone, Calendar, ShieldCheck, Upload, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem('role'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Save details to localStorage
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      fullName: formData.get('fullName'),
      phone: formData.get('phone'),
      dob: formData.get('dob'),
      idUploaded: !!file
    };
    localStorage.setItem('userProfile', JSON.stringify(data));
    localStorage.setItem('onboardingComplete', 'true');
    
    router.push('/dashboard');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-50 rounded-full blur-[120px] opacity-60" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-xl w-full"
      >
        <div className="text-center space-y-3 mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black text-white mb-4 shadow-xl"
          >
            <ShieldCheck className="w-8 h-8" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-black">Complete your profile</h1>
          <p className="text-neutral-500 font-medium text-lg">Just a few more details to get you started</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-10 rounded-[40px] border border-neutral-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] space-y-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <User className="w-3 h-3" /> Full Name
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                required
                className="w-full px-5 py-4 rounded-2xl bg-neutral-50 border border-transparent focus:bg-white focus:border-black focus:ring-8 focus:ring-black/5 outline-none transition-all font-semibold text-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Phone className="w-3 h-3" /> Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+1 (555) 000-0000"
                  required
                  className="w-full px-5 py-4 rounded-2xl bg-neutral-50 border border-transparent focus:bg-white focus:border-black focus:ring-8 focus:ring-black/5 outline-none transition-all font-semibold text-lg"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  required
                  className="w-full px-5 py-4 rounded-2xl bg-neutral-50 border border-transparent focus:bg-white focus:border-black focus:ring-8 focus:ring-black/5 outline-none transition-all font-semibold text-lg"
                />
              </div>
            </div>

            {/* Govt ID Upload - Only for Patients */}
            {role === 'patient' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Govt ID Proof
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    id="govtId"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 ${file ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-neutral-50 group-hover:bg-white group-hover:border-black'}`}>
                    {file ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <span className="text-green-700 font-bold">{file.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-neutral-400 group-hover:text-black transition-colors" />
                        <div className="text-center">
                          <span className="text-sm font-bold text-black block">Upload ID proof</span>
                          <span className="text-xs text-neutral-500 font-medium">PDF, PNG, JPG (max 5MB)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              type="submit"
              className="w-full mt-8 py-5 rounded-2xl bg-black text-white font-black text-lg tracking-wide border border-transparent hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] transition-all duration-300 flex items-center justify-center gap-3 disabled:bg-neutral-400"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Complete Profile <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-xs text-neutral-400 font-bold tracking-wide">
            Your data is encrypted and protected following global healthcare standards.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
