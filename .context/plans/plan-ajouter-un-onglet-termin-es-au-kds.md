# Plan : Ajouter un onglet "Terminées" au KDS

## Contexte
Le KDS affiche actuellement uniquement les 3 colonnes actives (En attente, En cours, Prêt). L'utilisateur veut pouvoir consulter les commandes terminées dans un onglet séparé avec recherche et filtres.

## Approche
Ajouter un système de tabs `Actif / Terminées` au KDS en utilisant le composant `Tabs variant="line"` (pattern déjà utilisé dans OrdersContent et ProductsContent).

## Fichiers à modifier

### 1. `apps/restaurant-theme/components/admin/kitchen/KitchenContent.tsx`
- Wrapper avec `<Tabs defaultValue="active">` et 2 onglets :
  - **Actif** : kanban actuel (3 colonnes)
  - **Terminées** : nouveau composant `CompletedTickets`
- Les singletons KDS (SoundManager, PrintTrigger, PrintStatusBadge, StationFilter) restent en dehors des tabs (toujours visibles)

### 2. `apps/restaurant-theme/components/admin/kitchen/CompletedTickets.tsx` (nouveau)
- Utilise `api.kitchenTickets.getByStatus` avec `status: "completed"` (query indexée existante)
- **Barre de recherche** : `Input` avec icone Search (filtre par orderNumber, customerName, productName)
- **Filtres** :
  - Source (Tous / Site web / Uber Eats / Deliveroo / Caisse) via `Select`
  - Type (Tous / Livraison / A emporter / Sur place) via `Select`
- **Grille de cards** : réutilise `TicketCard` en mode compact (les boutons d'action ne s'affichent pas car `status === "completed"`)
- Filtrage client-side (pattern existant dans le projet)

### 3. `apps/restaurant-theme/components/admin/kitchen/index.ts`
- Exporter `CompletedTickets`

## Détails d'implémentation

**Tab "Actif"** (contenu actuel inchangé) :
- StationFilter + PrintStatusBadge
- Kanban 3 colonnes

**Tab "Terminées"** :
```
[Rechercher par numero, client, produit...]  [Source: Tous v]  [Type: Tous v]
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ #TEST-0001  │ │ #TEST-0005  │ │ #TEST-0008  │
│ ...         │ │ ...         │ │ ...         │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Vérification
- Naviguer vers `/orders/kitchen`
- Vérifier que l'onglet "Actif" affiche le kanban actuel
- Cliquer sur "Terminées" et vérifier la liste des commandes complétées
- Tester la recherche (par numéro, client, produit)
- Tester les filtres source et type
