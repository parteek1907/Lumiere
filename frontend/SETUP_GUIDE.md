# 🚀 Lumiere Setup & Installation Guide

## Quick Start

### Prerequisites
- Node.js 18+ (with npm or yarn)
- Modern web browser

### Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   ```
   http://localhost:3000
   ```

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check (TypeScript validation)
npm run type-check
```

## Project Structure Explained

### `/src/app` - Next.js App Router Pages
- `page.tsx` - Home page with GLSL Hills 3D background
- `layout.tsx` - Root layout component
- `patients/page.tsx` - Patient records browsing
- `matches/page.tsx` - Duplicate detection interface
- `golden-record/page.tsx` - Unified patient profile
- `query/page.tsx` - Natural language query interface

### `/src/components` - React Components
- `Navbar.tsx` - Navigation bar with neon styling
- `ui/glsl-hills.tsx` - WebGL 3D animated background

### `/src/lib` - Utility Functions
- `api.ts` - API service functions (ready for real backend)
- `cn.ts` - Class name utility and color constants

### `/src/styles` - Global Styles
- `globals.css` - Root styles, animations, and Tailwind directives
- `components.css` - Component-specific styles

## Design System

### Color Palette
```javascript
// Neon Colors (use in Tailwind with text-neon-pink, bg-neon-cyan, etc.)
Primary: #ff2d95     (Neon Pink)
Secondary: #00f5d4   (Neon Cyan)
Accent: #7c3aed      (Neon Purple)
Dark BG: #0a0e27     (Dark Blue)
```

### Typography
- **Headlines**: Playfair Display (serif)
- **Body**: DM Sans (sans-serif)
- **Code**: DM Mono (monospace)

### Custom Tailwind Classes
- `text-neon-pink` / `text-neon-cyan` / `text-neon-purple`
- `bg-neon-pink` / `bg-neon-cyan` / `bg-neon-purple`
- `glow-neon` - Neon glow effect
- `animate-blob` - Morphing blob
- `animate-glow` - Pulsing glow
- `animate-float` - Floating motion
- `animate-shimmer` - Shimmer effect

## Backend Integration

### API Structure Ready
The `/src/lib/api.ts` file provides typed interfaces for:
- `fetchPatients()`
- `findDuplicates(patientId)`
- `mergeRecords(matchId)`
- `askQuestion(query)`
- `getGoldenRecord(patientId)`

Replace the mock implementations with real API calls:
```typescript
// Example: Replace mock with fetch
export async function fetchPatients(): Promise<Patient[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patients`);
  return res.json();
}
```

### Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## Deployment

### Build Production Bundle
```bash
npm run build
```

Optimized files will be in `.next/` directory.

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Other Hosting
1. Run `npm run build`
2. Upload `.next` folder and `package.json` to server
3. Install dependencies: `npm ci --only=production`
4. Start server: `npm start`

## Development Tips

### Adding New Pages
1. Create file at `/src/app/[route]/page.tsx`
2. Wrap with `'use client'` if using React hooks
3. Add route to Navbar links

### Styling Components
Use Tailwind utility classes with neon colors:
```tsx
<button className="px-6 py-3 rounded-lg bg-gradient-to-r from-neon-pink to-neon-purple text-white hover:shadow-neon-glow">
  Click Me
</button>
```

### Using Lucide Icons
```tsx
import { Star, Zap, Users } from 'lucide-react';

<Star className="w-6 h-6 text-neon-cyan" />
```

### Custom Animations
Keyframes defined in `tailwind.config.js`:
- `blob` (8s) - Smooth morphing
- `glow` (3s) - Pulsing glow
- `float` (6s) - Up and down motion
- `shimmer` (8s) - Shimmering effect

## TypeScript

### Type Safety
All component props and API responses are typed. Use TypeScript interfaces:

```tsx
interface PageProps {
  params: { id: string };
  searchParams: Record<string, string>;
}

export default async function Page({ params }: PageProps) {
  // Fully typed
}
```

### Generate Types
Run type checker:
```bash
npm run type-check
```

## Performance Tips

1. **Images**: Use Next.js `<Image>` component
2. **Lazy Load**: Use dynamic imports for heavy components
3. **Bundle**: Current bundle is optimized for WebGL rendering
4. **Caching**: Implement ISR for static with revalidation

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Port Already in Use
```bash
# Use different port
npm run dev -- -p 3001
```

### WebGL Not Working
- Check browser WebGL support
- Ensure Three.js is properly installed
- Clear browser cache

### Styling Issues
- Rebuild Tailwind: `npm run build`
- Check breakpoints in `tailwind.config.js`
- Verify utility classes are imported

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Three.js](https://threejs.org)
- [TypeScript](https://www.typescriptlang.org)
- [Lucide Icons](https://lucide.dev)

## Support

For issues or questions:
1. Check README.md for project overview
2. Review component implementations in `/src/components`
3. Check API structure in `/src/lib/api.ts`
4. Refer to original design reference

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Technology**: Next.js 14 + TypeScript + Tailwind CSS
