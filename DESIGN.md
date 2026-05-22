# Design System Document: The Luminescent Precision

## 1. Overview & Creative North Star: "The Digital Observatory"
This design system is engineered to transform dense analytical data into an immersive, high-fidelity environment. Moving away from the "cluttered dashboard" trope, our Creative North Star is **The Digital Observatory**. Imagine a high-end research facility where information isn't just displayed—it's illuminated.

Following a shift to **Dark Mode** as the primary theme (with full **Light Mode** support via Tailwind's `dark:` prefix pattern), the system now emphasizes depth, contrast, and "vibrant" energetic surfaces rather than flat light. We break the "template" look by eschewing rigid 12-column grids in favor of **intentional asymmetry**. Large-scale data visualizations should breathe, often taking up unconventional percentages of the screen (e.g., a 65/35 split), while typography scales are pushed to extremes—ultra-fine labels contrasted against bold, authoritative display metrics. The goal is a UI that feels like a bespoke tool crafted for an elite operator, emphasizing depth, tonal layering, and "vivid" sophistication.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in dense, mossy-gold foundations, utilizing a bright, pale-yellow primary for "sigil-like" accents that guide the eye to critical insights. In this dark-mode iteration, the updated neutral provides a warm, olive-tinted backdrop that feels like a specialized, focused workspace.

### Surface Hierarchy & Nesting
Depth is achieved through the **Layering Principle**, not lines.
- **Base Layer:** `surface` (#81783e) – The foundational core, providing a stabilized neutral backdrop with organic warmth.
- **Sectioning:** Use `surface-container-low` for large layout blocks to slightly lift them from the base.
- **Interactive Containers:** Use `surface-container-high` for cards and modals.
- **Nesting Rule:** To define an inner area (like a code snippet or a sub-chart), shift to `surface-container-lowest` to create a "recessed" look, or `surface-container-highest` for a "protruding" look.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to separate sections. Boundaries must be defined solely through background color shifts. If you feel a section needs a border, you haven't used the `surface-container` tiers correctly.

### The "Glass & Gradient" Rule
For floating elements (dropdowns, hover-cards), use **Glassmorphism**:
- **Fill:** `surface-variant` at 60% opacity.
- **Effect:** 12px – 20px Backdrop Blur.
- **Signature Texture:** Primary CTAs should use a subtle linear gradient from `primary` (#faee85) to `primary_container` at a 135-degree angle to add "soul" to the digital interface.

---

## 3. Typography: The Editorial Hierarchy
We use **Inter** for its mathematical precision and neutral character, allowing the data to remain the protagonist.

| Level | Size | Token | Usage |
| :--- | :--- | :--- | :--- |
| **Display-LG** | 3.5rem | `display-lg` | Hero metrics (e.g., Total Revenue) |
| **Headline-SM** | 1.5rem | `headline-sm` | Section titles |
| **Title-MD** | 1.125rem | `title-md` | Card titles |
| **Body-MD** | 0.875rem | `body-md` | General data and descriptions |
| **Label-SM** | 0.6875rem | `label-sm` | All-caps metadata, axis labels |

**Editorial Note:** Use `label-sm` with 0.05em letter-spacing for all-caps "micro-copy" to create an authoritative, technical feel.

---

## 4. Elevation & Depth: Atmospheric Immersion
In dark mode, elevation is defined by subtle contrast shifts and soft, chromatic glows.

- **The Ghost Border:** If accessibility requires a stroke (e.g., input fields), use `outline_variant` at **15% opacity**. It should be felt, not seen.
- **Ambient Shadows:** For high-elevation elements (modals), use a shadow color of `primary` at 5% opacity with a 40px blur. This mimics the "glow" of the screen rather than a physical shadow.
- **Nesting Depth:** A `surface-container-highest` card placed on a `surface` background creates an immediate, soft lift. This is our primary method of elevation.

---

## 5. Components: Precision Primitive Styling

### Data Tables (The "Fluid Grid")
- **Header:** Use `surface-container-low`. No bottom border. Use a vertical 4px `primary` accent bar on the far left of the active row only.
- **Rows:** Alternating background shifts are forbidden. Use generous vertical whitespace to separate data, utilizing the `spacing: 2` (Normal) setting.
- **Separation:** Use `outline_variant` at 10% opacity for horizontal lines only if the data density is extreme (>15 columns).

### Tabs & Dropdown Chips
- **Tabs:** No "folder" shapes. Use `on_surface_variant` text. The active state is indicated by `primary` text and a 2px "glow" line underneath.
- **Chips:** Roundedness: `1` (Subtle). Background: `surface-container-high`. On hover, shift to `secondary_container`. Avoid heavy borders; use a subtle `surface-bright` inner glow for depth.

### Sliders (The "Friction" Element)
- **Track:** `surface-container-highest`.
- **Active Range:** Gradient from `primary` (#faee85) to `primary_container`.
- **Thumb:** `primary_fixed_dim`. Use a 4px `primary` glow (shadow) when active to simulate heat/energy.

### Input Fields
- **Background:** `surface-container-lowest`.
- **Border:** Ghost Border (15% opacity `outline_variant`).
- **Focus State:** Border becomes 100% `primary` with a 2px outer glow.

---

## 6. Do’s and Don'ts

### Do
- **Do** use asymmetrical layouts (e.g., a small "Insight" sidebar next to a large "Trend" graph).
- **Do** use `tertiary` (#98fff9) for "Electric-cyan" highlights or technical callouts—it provides a sharp, high-contrast digital highlight against the mossy-gold foundations.
- **Do** maximize whitespace. Following the `spacing: 2` standard, ensure components have breathing room to allow for editorial clarity.

### Don't
- **Don't** use 100% black (#000000) for backgrounds. Always use `surface` to maintain the atmospheric aesthetic and tonal softness.
- **Don't** use standard `drop-shadow` presets. Build shadows using the ambient light rules (tinted, high-blur, low-opacity).
- **Don't** use dividers between list items. Use the defined `spacing` gaps to let the eye group the information naturally.