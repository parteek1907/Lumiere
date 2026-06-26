'use client';

import { useEffect, useState } from 'react';
import ClinicianDashboard from '@/components/dashboard/ClinicianDashboard';
import PatientDashboard from '@/components/dashboard/PatientDashboard';

export default function DashboardOverview() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    setRole(storedRole);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback to clinician if role is not set, or render based on role
  if (role === 'patient') {
    return <PatientDashboard />;
  }

  return <ClinicianDashboard />;
}
