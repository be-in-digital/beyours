# DESIGN-GUIDELINES.md — Workflow & UI/UX Standards

> Companion file to the global CLAUDE.md.
> Defines the structured development workflow and the UI/UX design standards.

---

## Structured development workflow

For any complex task (multi-file, new feature, major refactor), these 3 phases are mandatory.
For simple tasks (quick fix, question, single-file edit), go straight to the point.

### Phase 1 — PLANNING

- Analyze the existing codebase and identify the affected files/modules
- Write an implementation plan before writing any code:
  - Goal and context
  - List of files to create / modify / delete
  - Group the changes by component (dependencies first)
  - Identify breaking changes and risks
- Use this checklist format to track progress:
  - `[ ]` to do
  - `[/]` in progress
  - `[x]` done
- **Never write code before the plan is approved**

### Phase 2 — EXECUTION

- Implement the approved plan, component by component
- Keep the checklist up to date as you go
- Unexpected complexity → go back to PLANNING, do not improvise
- Not enough context → ask for clarification rather than guess

### Phase 3 — VERIFICATION

- Test the changes (unit, integration, e2e as appropriate)
- Confirm zero regressions on existing functionality
- Summarize what was done + the test results
- Minor bugs → fix and re-verify (stay in VERIFICATION)
- Fundamental design problem → back to PLANNING

---

## Implementation plan format

```markdown
# [Goal]

Short description of the problem and what the change accomplishes.

## Points needing approval

> [!WARNING]
> Breaking changes, major design decisions, architecture choices...

## Proposed changes

### [Component/module name]

#### [MODIFY] file.tsx
- Description of the changes

#### [NEW] new-file.tsx
- Description of the contents

#### [DELETE] old-file.tsx
- Reason for removal

## Verification plan

- Exact test commands to run
- Manual checks if needed
```

---

## UI/UX Design Standards

### Core principles

1. **Intent above all** — Every design choice needs a reason. Not "it looks nice", but "it steers the user toward X".
2. **Consistency** — One unified design system across the whole project. Use CSS variables / Tailwind tokens for colors, spacing, typography.
3. **Mobile-first** — Design for mobile/tablet first (a restaurant context usually means a tablet or a small screen).
4. **Accessibility** — Sufficient contrast, touch targets ≥ 44px, labels on inputs, keyboard navigation.

### Typography

- Pick distinctive, readable typefaces, not generic ones (avoid defaulting to Inter, Arial, Roboto)
- Pair a display face (headings) with a complementary body face (running text)
- Clear hierarchy: distinct sizes, weights and colors across h1 → h2 → h3 → body → caption
- Use Google Fonts or self-hosted fonts for performance

### Colors & Themes

- Define a palette through CSS variables / Tailwind config:
  - Primary color (brand)
  - Secondary color (accent)
  - Semantic colors (success, warning, error, info)
  - Neutral colors (backgrounds, borders, text)
- One dominant color with sharp accents beats an evenly spread palette
- Support dark mode from the start (shadcn/ui makes it easy)
- Never hardcode colors in components

### Layout & Composition

- Use CSS grid / Flexbox with consistent breakpoints
- Work the whitespace: generous margins beat cramming everything in
- Controlled asymmetry and elements that break the grid (where it fits) to avoid the "template" look
- Collapsible sidebar (icon mode) for dashboards — essential with 25+ navigation items

### Animations & Micro-interactions

- Prefer native CSS (transitions, keyframes) for performance
- Framer Motion for complex animations in React
- Focus on the high-impact moments:
  - Page entry (staggered reveal)
  - Surprising hover states
  - Feedback on actions (buttons, forms)
  - Transitions between views
- Subtle > flashy: animations that guide, not animations that distract
- `prefers-reduced-motion`: always honor this user preference

### Backgrounds & Visual details

- Build depth instead of flat backgrounds (subtle gradients, light textures, layered shadows)
- Techniques available: gradient mesh, noise textures, geometric patterns, transparency, grain overlays
- Fit the context: a restaurant dashboard ≠ a marketing landing page

### Components (shadcn/ui + Tailwind)

- shadcn/ui as the base, customize the variants for the brand
- Every component must be:
  - Responsive by default
  - Accessible (aria labels, keyboard nav, focus rings)
  - Consistent with the design system (colors, spacing, border-radius)
- Prefer composable components (Compound Components) over huge prop lists
- No prop drilling beyond 2 levels → Zustand or Context

### What to avoid at all costs

- ❌ The "generic AI" look: purple gradients on white, predictable layouts, default fonts
- ❌ Bolding or capitalizing everything
- ❌ Animation overload with no purpose
- ❌ Hardcoded colors in components
- ❌ Ignoring states (loading, empty, error, disabled)
- ❌ Forgetting responsive / touch targets on mobile

### What to always do

- ✅ Handle EVERY UI state: loading, empty, error, success, disabled
- ✅ Skeleton loaders rather than spinners where possible
- ✅ Immediate visual feedback on every user action
- ✅ Smooth transitions between pages/views
- ✅ Test on mobile, tablet AND desktop
- ✅ Use CSS variables for anything themeable
