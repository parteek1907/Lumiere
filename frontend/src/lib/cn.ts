// src/lib/cn.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Neon color variables
 */
export const colors = {
  neonPink: '#ff2d95',
  neonCyan: '#00f5d4',
  neonPurple: '#7c3aed',
  darkBg: '#0a0e27',
  darkCard: 'rgba(255, 255, 255, 0.03)',
};

/**
 * Gradient presets
 */
export const gradients = {
  neon: 'linear-gradient(135deg, #ff2d95 0%, #7c3aed 50%, #00f5d4 100%)',
  dark: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3a 50%, #0f0a2e 100%)',
  pink2Purple: 'linear-gradient(to right, #ff2d95, #7c3aed)',
  cyan2Purple: 'linear-gradient(to right, #00f5d4, #7c3aed)',
};
