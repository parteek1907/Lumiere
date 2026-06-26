'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 relative group',
  {
    variants: {
      variant: {
        primary: 
          'bg-black text-white hover:bg-white hover:text-black border border-transparent hover:border-black shadow-[0_10px_30px_rgba(0,0,0,0.1)] hover:shadow-lg',
        outline: 
          'bg-white text-black border border-neutral-200 hover:border-neutral-800 shadow-sm hover:shadow-[0_0_20px_rgba(148,163,184,0.15)]', // Subtle blue-grey glow
      },
      size: {
        sm: 'px-6 py-2',
        md: 'px-10 py-4',
        lg: 'px-12 py-5 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const NeonButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(props as any)}
      />
    );
  }
);

NeonButton.displayName = 'NeonButton';

export { NeonButton, buttonVariants };
