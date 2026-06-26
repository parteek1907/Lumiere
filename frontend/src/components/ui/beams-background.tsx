'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface BeamsBackgroundProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'subtle' | 'normal' | 'pronounced';
}

export const BeamsBackground = ({
  children,
  className,
  intensity = 'subtle',
}: BeamsBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const beams: Beam[] = [];
    const beamCount = width < 768 ? 15 : 25; // Increase count
    
    const beamOpacity = intensity === 'subtle' ? 0.4 : intensity === 'normal' ? 0.6 : 0.8;

    class Beam {
      x: number;
      y: number;
      length: number;
      width: number;
      speed: number;
      angle: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.length = Math.random() * 800 + 500;
        this.width = Math.random() * 15 + 10; // Thicker beams for raw visibility
        this.speed = Math.random() * 0.4 + 0.2;
        this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.1;
      }

      update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (this.x > width + 100 || this.y > height + 100) {
          this.x = -100;
          this.y = Math.random() * height - 200;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(
          this.x,
          this.y,
          this.x + Math.cos(this.angle) * this.length,
          this.y + Math.sin(this.angle) * this.length
        );
        
        // Greyish tones as requested
        gradient.addColorStop(0, `rgba(156, 163, 175, 0)`);
        gradient.addColorStop(0.5, `rgba(156, 163, 175, ${beamOpacity})`);
        gradient.addColorStop(1, `rgba(156, 163, 175, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
          this.x + Math.cos(this.angle) * this.length,
          this.y + Math.sin(this.angle) * this.length
        );
        ctx.stroke();
      }
    }

    for (let i = 0; i < beamCount; i++) {
      beams.push(new Beam());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Much lower blur to ensure they are visible and non-faded
      ctx.filter = "blur(12px)";
      
      beams.forEach((beam) => {
        beam.update();
        beam.draw();
      });

      requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [intensity]);

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-white", className)}>
      <div className="fixed inset-0 bg-[#F8FAFC] z-[-1]" />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />
      {/* Removed the heavy white overlay to maximize brightness of the beams */}
      
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};
