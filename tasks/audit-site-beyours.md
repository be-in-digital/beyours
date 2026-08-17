# Audit beyours.fr — SEO, performance, conversion

Réalisé le 2026-08-17 sur la **production**. Toutes les mesures viennent de
requêtes réelles ou de l'API Performance du navigateur, pas d'estimations.

---

## SEO Health Index : **76 / 100** — bande « Good »

> ⚠️ **Score à lire avec réserve.** Un problème **critique** non résolu subsiste
> (canonical hérité). Tant qu'il tient, la bande « Good » surestime la santé réelle :
> le site est techniquement sain mais **exclut lui-même 50 pages de l'index**.

| Catégorie | Score | Poids | Contribution |
|---|---|---|---|
| Crawlabilité & indexation | 42 | 30 | 12,6 |
| Fondations techniques | 87 | 25 | 21,75 |
| Optimisation on-page | 92 | 20 | 18,4 |
| Qualité de contenu & E-E-A-T | 93 | 15 | 13,95 |
| Autorité & confiance | 93 | 10 | 9,3 |
| **Total** | | | **76** |

**Ce qui empêche le score de monter** : la crawlabilité, et elle seule. Les quatre
autres catégories sont entre 87 et 93.

---

## F1 — CRITIQUE · Le canonical de l'accueil est hérité par 50 pages

**Catégorie** : Crawlabilité & indexation
**Sévérité** : Critique · **Confiance** : Haute · **Impact score** : −30

**Preuve**
```
apps/site/app/layout.tsx:104     alternates: { canonical: "/" }

curl https://beyours.fr/templates/asiatique-bambou
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="https://beyours.fr"/>     ← l'ACCUEIL
```

Next.js fait hériter les métadonnées de la racine. Dix pages redéfinissent
`alternates.canonical` (`/tarifs`, `/contact`, `/cgv`…). Toutes les autres héritent
du canonical de l'accueil.

**Pages touchées** : les **50 pages `/templates/[slug]`** et les **8 pages
`/parrainage`**. Chacune répond en 200, porte un titre unique généré par
`generateMetadata`, et se déclare simultanément « indexe-moi » et « je suis un
doublon de l'accueil ».

**Pourquoi ça compte** : Google respecte le canonical. Ces 50 pages, chacune ciblant
une requête de longue traîne (« template site restaurant asiatique », « template
pizzeria »…), ne peuvent pas se positionner. C'est le catalogue produit entier qui
est invisible.

**Recommandation** : retirer le `canonical: "/"` du layout racine, ou le remplacer par
un canonical auto-référent calculé depuis le chemin courant. Les pages qui le
redéfinissent déjà ne bougent pas.

> Les 24 pages `/demo/[slug]` héritent du même canonical mais sont en
> `noindex, nofollow` : exclusion volontaire, pas de correctif nécessaire.

---

## F2 — HAUTE · Le sitemap ne couvre que 7 URLs sur ~65 indexables

**Catégorie** : Crawlabilité & indexation
**Sévérité** : Haute · **Confiance** : Haute · **Impact score** : −10

**Preuve** — contenu réel de `sitemap.xml` :
```
/  /a-propos  /contact  /fonctionnalites  /parrainage  /tarifs  /templates
```

**Absents** : les 50 `/templates/[slug]`, `/decouvrir`, `/cgv`, `/confidentialite`,
`/mentions-legales`.

**Pourquoi ça compte** : `/decouvrir` est une page de vente qui a pourtant son
canonical propre et `index, follow` — elle est correctement configurée mais jamais
signalée. Les pages légales absentes affaiblissent les signaux de confiance.

**Recommandation** : générer le sitemap depuis `getAllTemplateSlugs()` plutôt que
depuis une liste écrite à la main.

---

## F3 — HAUTE · Aucun lien crawlable vers les pages templates

**Catégorie** : Crawlabilité & indexation
**Sévérité** : Haute · **Confiance** : Haute · **Impact score** : −10

**Preuve**
```
curl https://beyours.fr/templates | grep -c 'href="/templates/[a-z0-9-]+"'
→ 0
```

La liste des 50 templates est rendue côté client. Le HTML servi ne contient aucun
lien `<a href="/templates/...">`.

**Pourquoi ça compte** : cumulé à F1 et F2, ça fait **trois verrous indépendants** sur
les mêmes 50 pages. Corriger le canonical seul ne suffira pas : sans lien ni sitemap,
Google ne les découvrira pas.

**Recommandation** : rendre la grille de templates en SSR, ou au minimum exposer les
liens dans le HTML initial.

---

## F4 — MOYENNE · Poids de page au-dessus de la cible

**Catégorie** : Fondations techniques
**Sévérité** : Moyenne · **Confiance** : Haute · **Impact score** : −5

**Mesures réelles (accueil)**
```
TTFB                    72 ms     excellent
FCP                    400 ms     excellent
DOM interactive        333 ms
CLS                        0      parfait
Requêtes                  77
Transfert compressé   777 Ko      au-dessus de la cible (~500 Ko)
Décompressé           1,9 Mo
HTML seul             201 Ko      très lourd pour une page marketing
Nœuds DOM              1161       raisonnable
```

Ressources les plus lourdes : un CSS de **154 Ko**, des chunks JS de **222, 134 et
130 Ko**.

**Limite de la mesure** : le LCP n'a pas pu être capturé dans mon contexte
d'exécution. À confirmer via PageSpeed Insights sur données terrain avant toute
conclusion sur les Core Web Vitals.

---

## F5 — MOYENNE · 28 requêtes `fetch` sur une page marketing

**Catégorie** : Fondations techniques
**Sévérité** : Moyenne · **Confiance** : Moyenne · **Impact score** : −5

77 requêtes au total dont **28 de type `fetch`**, pour 43 Ko. Sur une page de vente
statique, ce volume interroge — probablement des abonnements Convex montés au
chargement.

**Recommandation** : vérifier si ces appels sont nécessaires avant la première
interaction. Chaque connexion retarde l'interactivité sur mobile en 4G.

---

## F6 — MOYENNE · Descriptions trop courtes sur deux pages

**Catégorie** : Optimisation on-page
**Sévérité** : Moyenne · **Confiance** : Haute · **Impact score** : −5

| Page | Longueur description | Titre |
|---|---|---|
| `/contact` | 93 car. | 30 car. |
| `/parrainage` | 89 car. | 58 car. |

En dessous des ~120-158 caractères qui remplissent l'extrait Google. Les titres de
`/tarifs` (29), `/templates` (32) et `/contact` (30) laissent aussi de la place
inexploitée.

**Le reste est propre** : 11 pages publiques, **aucun titre ni description en
double**, un seul `<h1>` par page, **18 images sur 18 avec un `alt`**, JSON-LD présent.

---

## F7 — MOYENNE · L'identité du rendez-vous est celle de l'agence, pas du produit

**Catégorie** : Autorité & confiance
**Sévérité** : Moyenne · **Confiance** : Haute · **Impact score** : −5

**Preuve**
```
apps/site/components/calendly-modal.tsx:8
  const CALENDLY_URL = "https://calendly.com/hello-beindigital/new-meeting"   [EN DUR]

apps/site/convex/email/send.ts:57
  return process.env.CALENDLY_URL ?? undefined                                [VARIABLE]
```

Le lien répond bien (HTTP 200), donc le parcours fonctionne. Mais :

1. **Deux sources de vérité.** Le composant a l'URL en dur, l'email lit une variable
   d'environnement. Elles peuvent diverger sans que personne le voie.
2. **Mauvaise marque au pire moment.** Un prospect venu de beyours.fr atterrit sur un
   Calendly `hello-beindigital`. Or le `README` pose la règle : *BeYours est le produit
   vendu aux restaurateurs, BeInDigital est l'agence. Deux marques, deux entreprises.*
   La rupture arrive exactement à l'étape de conversion.
3. **`new-meeting` est le slug par défaut de Calendly**, pas un type d'événement nommé.
   Un prospect voit un intitulé générique au lieu de « Démo BeYours — 30 min ».

**Recommandation** : une seule source (`CALENDLY_URL` en variable), un compte ou un
type d'événement aux couleurs BeYours, et un intitulé explicite.

---

## F8 — MOYENNE · Aucune preuve sociale publiée

**Catégorie** : Qualité de contenu & E-E-A-T
**Sévérité** : Moyenne · **Confiance** : Haute · **Impact score** : −5

L'offre fondateurs demande explicitement *« une étude de cas chiffrée et un témoignage
publiables »* en échange de la remise de 1 000 €. Aucun témoignage, logo client ou
étude de cas n'est visible sur les pages auditées.

**Pourquoi ça compte** : le site demande 2 600 € à un restaurateur qui ne connaît pas
la marque, sans montrer un seul client existant. C'est le principal frein à la
conversion, devant tout problème technique.

---

## Ce qui est déjà bon

À ne pas casser en corrigeant le reste.

**Technique**
- HTTPS partout, `http → https` et `www → apex` en **308** propres
- TTFB 72 ms, FCP 400 ms, **CLS à 0**
- `viewport` correct avec `maximum-scale=5` (zoom non bloqué, bon point d'accessibilité)
- `robots.txt` bien construit : `Allow: /`, `Disallow: /checkout/` et `/api/`, avec
  `Host` et `Sitemap` déclarés

**On-page**
- Un seul `<h1>` sur chacune des 11 pages publiques
- Zéro titre ou description dupliqué
- 18 images sur 18 avec attribut `alt`
- Open Graph complet avec image 1200×630 générée
- JSON-LD présent sur l'accueil

**Commercial**
- H1 direct et sans jargon : *« Vendez en direct, sans commission. »*
- Calculateur de commissions interactif, avec comparaison chiffrée (8 000 €/mois de
  ventes → jusqu'à 2 400 €/mois reversés aux plateformes)
- Récapitulatif de commande exact : 2 500 € création + 100 € maintenance = 2 600 €
- Mentions légales complètes, TVA art. 293 B du CGI affichée
- Paiement fractionné Alma/Klarna annoncé
- Parcours d'achat fonctionnel jusqu'au formulaire

---

## Plan d'action par ordre de rendement

### 1. Blocage critique — débloque 50 pages

- **F1** retirer le `canonical: "/"` du layout racine → canonical auto-référent
- **F2** générer le sitemap depuis `getAllTemplateSlugs()`
- **F3** rendre les liens templates crawlables en SSR

Les trois vont ensemble : corrigés séparément, aucun ne produit d'effet.
**Récupération estimée : +25 à +30 points** sur l'index global.

### 2. Fort impact commercial

- **F8** publier une étude de cas et un témoignage — c'est déjà négocié dans l'offre fondateurs
- **F7** unifier l'identité du rendez-vous sous la marque BeYours

### 3. Gains rapides

- **F6** allonger les descriptions de `/contact` et `/parrainage`, enrichir 3 titres
- Ajouter `/decouvrir` et les pages légales au sitemap

### 4. Fond de tableau

- **F4** découper le CSS de 154 Ko et les chunks JS
- **F5** vérifier la nécessité des 28 `fetch` au chargement

---

## Limites de cet audit

- **Le LCP n'a pas été mesuré.** À confirmer sur données terrain (PageSpeed Insights,
  Search Console) avant toute conclusion sur les Core Web Vitals.
- **Aucun accès Search Console.** La couverture d'indexation réelle n'est pas vérifiée :
  les conclusions sur l'indexation sont déduites des directives servies, pas observées.
- **Le paiement n'a pas été testé de bout en bout.** Le parcours a été vérifié jusqu'au
  formulaire ; ni carte saisie, ni commande créée.
- **Aucune donnée d'audience.** Les recommandations de conversion reposent sur la
  structure des pages, pas sur des taux observés.
- Le score reflète une **préparation SEO**, pas une garantie de positionnement.
