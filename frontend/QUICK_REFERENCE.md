# 🎯 Quick Reference Card

## Color Palette

### Tailwind Classes
```
Text:       text-neon-pink / text-neon-cyan / text-neon-purple
Background: bg-neon-pink / bg-neon-cyan / bg-neon-purple
Border:     border-neon-pink / border-neon-cyan / border-neon-purple
Shadow:     shadow-neon-glow / shadow-neon-lg
```

### Hex Values
```
#ff2d95     Neon Pink (Primary)
#00f5d4     Neon Cyan (Secondary)
#7c3aed     Neon Purple (Accent)
#0a0e27     Dark Background
```

---

## Animations

### Keyframe Animations
```
animate-blob        (8s)    Morphing blob effect
animate-glow        (3s)    Pulsing glow
animate-float       (6s)    Floating up/down
animate-pulse-neon  (2s)    Neon pulse
animate-shimmer     (8s)    Shimmer effect
```

### Tailwind Animations
```
animate-pulse       Built-in fade
animate-spin        Built-in rotation
animate-bounce      Built-in bounce
```

---

## Component Usage

### GLSLHills (3D Background)
```tsx
import { GLSLHills } from '@/components/ui/glsl-hills';

<GLSLHills 
  width="100vw"
  height="100vh"
  cameraZ={125}
  planeSize={256}
  speed={0.5}
/>
```

### Navbar
```tsx
// Already included in layout.tsx
// Shows active route with glow effect
```

### Lucide Icons
```tsx
import { Star, Zap, Users, Search } from 'lucide-react';

<Star className="w-6 h-6 text-neon-cyan" fill="currentColor" />
```

---

## Common Patterns

### Button with Glow
```tsx
<button className="px-6 py-3 rounded-lg bg-gradient-to-r from-neon-pink to-neon-purple text-white hover:shadow-neon-glow transition-all duration-300">
  Click Me
</button>
```

### Card with Neon Border
```tsx
<div className="p-6 rounded-xl bg-dark-card border border-neon-pink/20 hover:border-neon-pink/60 backdrop-blur transition-all duration-300">
  Content
</div>
```

### Gradient Text
```tsx
<h1 className="text-transparent bg-clip-text bg-gradient-to-r from-neon-pink to-neon-cyan">
  Fancy Text
</h1>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>
```

---

## File Locations

### Pages
```
/src/app/page.tsx               Home
/src/app/patients/page.tsx      Patients
/src/app/matches/page.tsx       Matches
/src/app/golden-record/page.tsx Golden Record
/src/app/query/page.tsx         Query
```

### Components
```
/src/components/Navbar.tsx      Navigation
/src/components/ui/glsl-hills.tsx 3D Background
```

### Utilities
```
/src/lib/api.ts                 API Functions
/src/lib/cn.ts                  Styling Utils
```

### Styles
```
/src/styles/globals.css         Global Styles
/src/styles/components.css      Component Styles
```

---

## Commands

```bash
# Development
npm run dev              Start dev server (localhost:3000)
npm run build            Build for production
npm start                Start production server
npm run type-check       Check TypeScript errors

# Installation
npm install              Install all dependencies
```

---

## Key Features

✨ **Neon Dark Theme** - Modern Aesthetic  
🎨 **Custom Animations** - Smooth 0.3s Transitions  
📱 **Responsive** - Mobile to Desktop  
🌐 **3D Graphics** - WebGL with Three.js  
🔤 **TypeScript** - Full Type Safety  
🎯 **Icons** - Lucide React Library  
⚡ **Next.js 14** - App Router + SSR  
🎭 **Glass Morphism** - Backdrop Blur Effects  

---

## Responsive Breakpoints

```
Mobile:     < 640px   (sm)
Tablet:     640px-1024px (md, lg)
Desktop:    > 1024px  (xl)
```

---

## CSS Variables (in :root)

```css
--neon-pink: #ff2d95;
--neon-cyan: #00f5d4;
--neon-purple: #7c3aed;
--dark-bg: #0a0e27;
--dark-card: rgba(255, 255, 255, 0.03);
```

---

## API Structure

All functions in `/src/lib/api.ts` return mocked data by default:

```ts
fetchPatients()              // Get all patients
findDuplicates(id)          // Find matches
mergeRecords(id)            // Merge records
askQuestion(query)          // Query with AI
getGoldenRecord(id)         // Get unified record
```

**To connect real backend**: Replace `fetch` calls with real API endpoints.

---

## Deployment Checklist

- [ ] Run `npm run build` successfully
- [ ] Run `npm run type-check` with no errors
- [ ] Update `.env.local` with API URLs
- [ ] Test all pages in production build
- [ ] Verify WebGL rendering works
- [ ] Check mobile responsiveness
- [ ] Test on different browsers

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome  | ✅ Full |
| Firefox | ✅ Full |
| Safari  | ✅ Full |
| Edge    | ✅ Full |
| IE      | ❌ No   |

---

## Performance Tips

- Use Next.js Image component
- Lazy load heavy components
- Implement proper caching
- Monitor bundle size
- Cache API responses

---

## Getting Help

1. **README.md** - Project overview
2. **SETUP_GUIDE.md** - Installation help
3. **TRANSFORMATION_SUMMARY.md** - What was built
4. **Source Code Comments** - In the components
5. **Official Docs**:
   - [Next.js](https://nextjs.org)
   - [Tailwind](https://tailwindcss.com)
   - [Three.js](https://threejs.org)

---

**Happy Coding! 🚀**
