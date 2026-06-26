'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'slate' | 'light' | 'primary';
  duration?: number;
  delay?: number;
}

export default function ShimmerText({
  children,
  className,
  duration = 4.0,
}: ShimmerTextProps) {
  return (
    <motion.span
      className={cn(
        "inline-block bg-clip-text text-transparent",
        "bg-[length:200%_100%]",
        className
      )}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{
        repeat: Infinity,
        duration: duration,
        ease: 'linear',
      }}
      style={{
        backgroundImage: 'linear-gradient(110deg, #1e293b 0%, #1e293b 40%, #cbd5e1 50%, #1e293b 60%, #1e293b 100%)',
      }}
    >
      {children}
    </motion.span>
  );
}
