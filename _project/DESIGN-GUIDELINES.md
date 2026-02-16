# DESIGN-GUIDELINES.md — Workflow & UI/UX Standards

> Fichier complémentaire au CLAUDE.md global.
> Définit le workflow de développement structuré et les standards de design UI/UX.

---

## Workflow de développement structuré

Pour toute tâche complexe (multi-fichiers, nouvelle feature, refactor majeur), suivre obligatoirement ces 3 phases.
Pour les tâches simples (fix rapide, question, édition d'un seul fichier), aller droit au but.

### Phase 1 — PLANNING

- Analyser le codebase existant et identifier les fichiers/modules impactés
- Créer un plan d'implémentation avant d'écrire du code :
  - Objectif et contexte
  - Liste des fichiers à créer / modifier / supprimer
  - Grouper les changements par composant (dépendances d'abord)
  - Identifier les breaking changes et risques
- Utiliser ce format de checklist pour le suivi :
  - `[ ]` à faire
  - `[/]` en cours
  - `[x]` terminé
- **Ne jamais coder avant validation du plan**

### Phase 2 — EXECUTION

- Implémenter selon le plan validé, composant par composant
- Mettre à jour la checklist au fur et à mesure
- Si complexité inattendue → revenir en PLANNING, ne pas improviser
- Si contexte insuffisant → demander des clarifications plutôt que deviner

### Phase 3 — VERIFICATION

- Tester les changements (unit, intégration, e2e selon le cas)
- Vérifier zéro régression sur les fonctionnalités existantes
- Résumer ce qui a été fait + résultats des tests
- Si bugs mineurs → corriger et re-vérifier (rester en VERIFICATION)
- Si problème de design fondamental → retour en PLANNING

---

## Format du plan d'implémentation

```markdown
# [Objectif]

Brève description du problème et de ce que le changement accomplit.

## Points nécessitant validation

> [!WARNING]
> Breaking changes, décisions de design majeures, choix d'architecture...

## Changements proposés

### [Nom du composant/module]

#### [MODIFY] fichier.tsx
- Description des modifications

#### [NEW] nouveau-fichier.tsx
- Description du contenu

#### [DELETE] ancien-fichier.tsx
- Raison de la suppression

## Plan de vérification

- Commandes de test exactes à lancer
- Vérifications manuelles si nécessaire
```

---

## Standards de Design UI/UX

### Principes fondamentaux

1. **Intention avant tout** — Chaque choix de design doit avoir une raison. Pas de "ça fait joli", mais "ça guide l'utilisateur vers X".
2. **Cohérence** — Un design system unifié sur tout le projet. Utiliser des CSS variables / tokens Tailwind pour les couleurs, espacements, typographies.
3. **Mobile-first** — Concevoir d'abord pour mobile/tablette (contexte restaurant = souvent sur tablette ou petit écran).
4. **Accessibilité** — Contrastes suffisants, tailles de touch targets ≥ 44px, labels sur les inputs, navigation clavier.

### Typographie

- Choisir des polices distinctives et lisibles, pas des polices génériques (éviter Inter, Arial, Roboto par défaut)
- Pairer une police display (titres) avec une police body (texte courant) complémentaire
- Hiérarchie claire : tailles, graisses et couleurs distinctes entre h1 → h2 → h3 → body → caption
- Utiliser des Google Fonts ou des polices auto-hébergées pour la performance

### Couleurs & Thèmes

- Définir une palette via CSS variables / Tailwind config :
  - Couleur primaire (brand)
  - Couleur secondaire (accent)
  - Couleurs sémantiques (success, warning, error, info)
  - Couleurs neutres (backgrounds, borders, textes)
- Une couleur dominante avec des accents marqués > une palette répartie uniformément
- Supporter le dark mode dès le départ (shadcn/ui le facilite)
- Ne jamais hardcoder les couleurs dans les composants

### Layout & Composition

- Utiliser des grilles CSS / Flexbox avec des breakpoints cohérents
- Jouer avec le whitespace : des marges généreuses > tout entassé
- Asymétrie contrôlée et éléments qui cassent la grille (quand c'est pertinent) pour éviter l'effet "template"
- Sidebar collapsible (mode icônes) pour les dashboards — indispensable avec 25+ items de navigation

### Animations & Micro-interactions

- Prioriser CSS natif (transitions, keyframes) pour la performance
- Framer Motion pour les animations complexes en React
- Se concentrer sur les moments à fort impact :
  - Entrée de page (staggered reveal)
  - Hover states surprenants
  - Feedback sur les actions (boutons, formulaires)
  - Transitions entre les vues
- Subtil > Flashy : des animations qui guident, pas qui distraient
- `prefers-reduced-motion` : toujours respecter cette préférence utilisateur

### Arrière-plans & Détails visuels

- Créer de la profondeur plutôt que des fonds plats (dégradés subtils, textures légères, ombres en couches)
- Techniques disponibles : gradient mesh, noise textures, patterns géométriques, transparences, grain overlays
- Adapter au contexte : un dashboard restaurant ≠ une landing page marketing

### Composants (shadcn/ui + Tailwind)

- shadcn/ui comme base, personnaliser les variantes pour le brand
- Chaque composant doit être :
  - Responsive par défaut
  - Accessible (aria labels, keyboard nav, focus rings)
  - Cohérent avec le design system (couleurs, espacements, border-radius)
- Préférer les composants composables (Compound Components) aux props massives
- Pas de props drilling > 2 niveaux → Zustand ou Context

### Ce qu'il faut éviter absolument

- ❌ Esthétique "AI générique" : gradients violet sur fond blanc, layouts prévisibles, polices par défaut
- ❌ Tout mettre en gras ou en majuscules
- ❌ Surcharge d'animations sans purpose
- ❌ Couleurs hardcodées dans les composants
- ❌ Ignorer les états (loading, empty, error, disabled)
- ❌ Oublier le responsive / touch targets sur mobile

### Ce qu'il faut toujours faire

- ✅ Gérer TOUS les états UI : loading, empty, error, success, disabled
- ✅ Skeleton loaders plutôt que spinners quand possible
- ✅ Feedback visuel immédiat sur chaque action utilisateur
- ✅ Transitions fluides entre les pages/vues
- ✅ Tester sur mobile, tablette ET desktop
- ✅ Utiliser les CSS variables pour tout ce qui est thématique
