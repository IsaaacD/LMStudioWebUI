# Artsy Landing Page for Ketamine Dreams

## Goal

Replace the current `index.html` redirect with a stylized landing page that serves as an informational hub for the Ketamine Dreams project.

## Context

- **Project**: Ketamine Dreams — a Three.js-based psychedelic immersive web experience
- **Current `index.html`**: Simple redirect script to `/ket`
- **Four scenes**: `nexus`, `space`, `lumber`, `liminal`
- **Scene URL**: `/ket?scene={sceneId}`
- **Ralph image**: `/ket/images/ralph.png`
- **Existing aesthetic**: Dark (#000 bg), monospace fonts, neon accents (#ff0055, #00ccff), glow/shadow effects, glitch vibes

## Design

### Visual Style
- **Dark background** with subtle animated gradient or noise texture
- **Monospace typography** (Courier New) consistent with the splash screen
- **Neon color palette**: #ff0055 (pink-red), #00ccff (cyan), #2cfa98 (green)
- **Non-orthogonal layout**: Rotated elements, staggered grid, asymmetric spacing
- **CSS animations**: Floating, pulsing, glitch-text effects, scanline overlay
- **CRT/retro-futuristic feel** matching the existing splash screen aesthetic

### Page Structure

1. **Hero section**: "KETAMINE DREAMS" title with glow animation, subtitle tagline
2. **Project overview**: Brief paragraph describing the project's nature
3. **Ralph image**: Displayed as a floating, animated element
4. **Four scene sections** (staggered/asymmetric layout):
   - Each has a scene title, technical description (placeholder), personal narrative (placeholder)
   - Clickable interactive element per scene
5. **Scene modal**: Dismissable modal with iframe that loads `/ket?scene={sceneId}` on click

### Scene Data

| Scene ID | File | Name |
|----------|------|------|
| `nexus` | cityScene.js | The Nexus |
| `space` | sparseScene.js | Sparse Space |
| `lumber` | lumberScene.js | Lumber |
| `liminal` | liminalScene.js | Liminal |

### Interactive Behavior
- Each scene section has a clickable trigger element
- Clicking opens a modal overlay containing an iframe
- The iframe loads `/ket?scene={sceneId}` (relative URL)
- Modal is dismissable (close button + click-outside)
- iframe only loads on click (lazy, not preloaded)
- Ralph.png displayed as a decorative floating image on the main page

## Implementation

### File to modify
- `index.html` — full rewrite (self-contained HTML with embedded CSS and JS)

### CSS Approach
- All CSS embedded in `<style>` tag within the HTML file
- CSS custom properties for colors and animation timing
- Keyframe animations for: glow pulse, float, glitch text, scanline overlay, modal fade-in
- Staggered layout using CSS Grid with varying column spans and rotations via `transform: rotate()`

### JS Approach
- All JS embedded in `<script>` tag
- Modal open/close logic
- Dynamic iframe src injection on scene click
- Click-outside-to-dismiss behavior

### No external dependencies
- Self-contained file, no framework imports needed
- Uses only vanilla HTML/CSS/JS

## Validation

- Open `index.html` in browser, verify:
  - Page renders with artsy styling and all four scene sections
  - Ralph image is visible
  - Clicking a scene opens the modal with the correct iframe URL
  - Modal is dismissable
  - No console errors
  - Page loads fast (no heavy assets loaded upfront)
