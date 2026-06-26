'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface AccordionItem {
  id: string;
  title: string;
  description: string;
  image: string;
}

const items: AccordionItem[] = [
  {
    id: '1',
    title: 'Golden Record',
    description: 'Consolidate fragmented data into a single, trusted source of truth for every patient.',
    image: '/assets/panel-1.jpg',
  },
  {
    id: '2',
    title: 'Accurate Data Matching',
    description: 'Advanced AI algorithms that identify and link disparate patient records with 99.9% accuracy.',
    image: '/assets/panel-2.jpg',
  },
  {
    id: '3',
    title: 'Natural Language Query',
    description: 'Ask complex clinical questions in plain English and get instant, evidence-based answers.',
    image: '/assets/panel-3.jpg',
  },
  {
    id: '4',
    title: 'Fragmentation Resolution',
    description: 'Solve the problem of siloed data across departments, clinics, and legacy systems.',
    image: '/assets/panel-4.jpg',
  },
  {
    id: '5',
    title: 'Clinical Insights',
    description: 'Surface actionable intelligence to improve patient outcomes and operational efficiency.',
    image: '/assets/panel-5.jpg',
  },
];

export function InteractiveImageAccordion() {
  const [hoveredId, setHoveredId] = useState<string | null>(items[0].id);

  return (
    <div className="w-full">
      {/* Desktop Accordion */}
      <div className="hidden md:flex h-[500px] w-full gap-4 items-stretch group/container">
        {items.map((item) => {
          const isHovered = hoveredId === item.id;
          return (
            <motion.div
              key={item.id}
              onMouseEnter={() => setHoveredId(item.id)}
              className={cn(
                "relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 ease-out h-full border border-neutral-800 flex-shrink-0",
                isHovered ? "flex-[4] shadow-2xl scale-[1.02] bg-black z-10" : "flex-1 bg-black hover:bg-neutral-900 z-0"
              )}
            >
              {/* Background Image - Only reveals on hover */}
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-all duration-700 scale-110 z-0",
                    isHovered ? "opacity-100 scale-100" : "opacity-0"
                  )}
                />
              )}
              
              {/* Fallback pattern when image is missing */}
              {!isHovered && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-200/20 to-transparent" />}
              
              {/* Overlay */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 transition-opacity duration-300",
                isHovered ? "opacity-100" : "opacity-0"
              )}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={isHovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-white text-base font-semibold leading-relaxed max-w-xs">{item.description}</p>
                </motion.div>
              </div>

              {/* Vertical Title (for collapsed state) */}
              {!isHovered && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/40 font-bold text-sm uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 group-hover:text-white transition-colors duration-300">
                    {item.title}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Mobile Horizontal Scroll */}
      <div className="flex md:hidden overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
        {items.map((item) => (
          <div 
            key={item.id}
            className="flex-none w-[280px] h-[400px] relative rounded-2xl overflow-hidden snap-start"
          >
            <img
              src={item.image}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-white/80 text-xs leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
