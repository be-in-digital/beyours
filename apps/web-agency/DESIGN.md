# Design — Site vitrine Be in Digital

## 1. Objectif

Créer un site vitrine **premium**, **immersif** et **très moderne** pour **Be in Digital**, en s’inspirant du site de référence tout en l’adaptant au branding de la marque.

Le site doit transmettre immédiatement :

* innovation,
* performance,
* crédibilité,
* maîtrise produit,
* spécialisation restauration,
* image premium.

---

## 2. Référence créative

Référence principale : le site Framer partagé par le client.

### Ce qu’on reprend de la référence

* univers **dark futuriste / premium tech**,
* ambiance immersive avec **glow, halos, light streaks, profondeur**,
* hero très visuel avec impact immédiat,
* grandes sections aérées,
* cartes produit / dashboard avec effet vitrine,
* compositions cinématiques,
* footer très marquant.

### Ce qu’on n’imite pas tel quel

* les couleurs bleu / violet dominantes,
* le wording générique type “AI SaaS”,
* les sections décoratives sans lien avec l’offre,
* les effets trop gratuits s’ils nuisent à la lisibilité.

---

## 3. Adaptation au branding Be in Digital

### Direction couleur

Le site doit conserver le langage visuel premium et immersif de la référence, mais être **recoloré** selon le branding Be in Digital.

L’intention couleur est :

* fond très sombre,
* accent mint / teal,
* texte clair,
* surfaces premium,
* halos lumineux contrôlés,
* contraste net.

### Règle importante

Le design ne doit **pas** être défini à partir de codes hex hardcodés dans les composants.

On veut un système basé sur des **variables CSS sémantiques** afin de :

* faciliter le theming,
* garder une cohérence globale,
* permettre des ajustements rapides,
* éviter les couleurs dispersées dans le code,
* préparer une éventuelle évolution du branding.

### Variables attendues

Le système couleur doit être pensé autour de variables comme :

* `--background`
* `--foreground`
* `--surface-1`
* `--surface-2`
* `--surface-3`
* `--card`
* `--card-foreground`
* `--primary`
* `--primary-foreground`
* `--secondary`
* `--secondary-foreground`
* `--muted`
* `--muted-foreground`
* `--border`
* `--input`
* `--ring`
* `--glow-primary`
* `--glow-soft`
* `--hero-radial`
* `--section-radial`

### Code couleur du branding

Même si l’implémentation doit reposer sur des variables CSS, on garde ici les **couleurs source du branding** pour servir de référence design.

#### Couleurs source

* Primary / Mint : `#52CFAF`
* Dark / Black : `#0A0A0A`
* White : `#FFFFFF`

#### Palette étendue de référence

* Primary 50 : `#EEFAF7`
* Primary 100 : `#DCF5EF`
* Primary 200 : `#C2EEE3`
* Primary 300 : `#A0E5D3`
* Primary 400 : `#7DDBC3`
* Primary 500 : `#52CFAF`
* Primary 600 : `#46B095`
* Primary 700 : `#39917A`
* Primary 800 : `#2D7260`
* Primary 900 : `#215346`

#### Neutres de référence

* Neutral 900 : `#0A0A0A`
* Neutral 800 : `#1A1A1A`
* Neutral 700 : `#2A2A2A`
* Neutral 600 : `#4A4A4A`
* Neutral 500 : `#6B6B6B`
* Neutral 400 : `#9A9A9A`
* Neutral 300 : `#CFCFCF`
* Neutral 200 : `#E8E8E8`
* Neutral 100 : `#F5F5F5`
* Neutral 50 : `#FAFAFA`

#### Mapping recommandé vers les variables CSS

* `--background` : fond principal très sombre dérivé de `#0A0A0A`
* `--foreground` : texte principal dérivé de `#FFFFFF`
* `--primary` : accent principal dérivé de `#52CFAF`
* `--primary-foreground` : texte sombre sur accent mint
* `--muted-foreground` : gris clair dérivé de la palette neutre
* `--border` : bordure subtile dérivée des neutres sombres
* `--glow-primary` : halo mint dérivé de `#52CFAF`

#### Règle d’usage

Les hex ci-dessus servent uniquement de **référentiel de branding**.
Le code du site doit ensuite passer par des **variables CSS sémantiques** et non par des hex dispersés dans les composants.

### Traduction visuelle de la référence

Le site de référence repose sur un univers néon bleu / violet sur fond sombre.

Pour Be in Digital, il faut :

* remplacer les lueurs violettes dominantes par des lueurs mint / teal,
* conserver un fond quasi noir,
* garder des surfaces sombres premium,
* utiliser l’accent de marque pour guider le regard,
* limiter le nombre de couleurs secondaires.

### Règle branding

Le site doit être perçu comme :

* premium,
* tech,
* élégant,
* maîtrisé,
* restaurant-first,
* orienté business.

Il ne doit pas être perçu comme :

* un template générique,
* un site crypto,
* un site gaming,
* un site “AI gadget”,
* un site trop froid ou trop corporate.

---

## 4. Direction artistique

### Intention visuelle

Créer une interface qui donne l’impression d’un produit digital de nouvelle génération, avec :

* profondeur,
* contrastes élégants,
* glow subtil,
* surfaces vitrées,
* cartes sombres premium,
* halos lumineux contrôlés,
* effets de perspective.

### Mot-clés créatifs

* dark luxury,
* food-tech premium,
* immersive SaaS,
* neon mint,
* futuristic but clean,
* sharp,
* elegant,
* cinematic UI.

### Règles visuelles

* fond principal très sombre,
* sections respirantes,
* pas trop de bruit visuel,
* glow subtil et contrôlé,
* effets lumineux utilisés pour guider l’œil,
* hiérarchie typographique forte,
* visuels produit toujours mis en valeur.

---

## 5. Architecture visuelle de la homepage

### 5.1 Navbar

* logo Be in Digital,
* liens principaux,
* CTA principal : **Réserver une démo** ou **Prendre rendez-vous**,
* style sombre avec légère transparence et bordure fine.

### 5.2 Hero

* badge,
* titre fort orienté transformation digitale restaurant,
* sous-titre orienté bénéfices,
* CTA principal,
* CTA secondaire,
* grand mockup produit ou composition dashboard + mobile + storefront,
* fond sombre avec flux lumineux et halo centré.

### 5.3 Section problème

Illustrer :

* dépendance aux plateformes,
* image digitale faible,
* outils dispersés,
* manque de fidélisation,
* perte de temps,
* difficulté à centraliser les opérations.

### 5.4 Section solution / plateforme

Présenter Be in Digital comme le centre de contrôle digital du restaurant :

* dashboard administrateur,
* storefront / commande en ligne,
* menu management,
* gestion des commandes,
* marketing / fidélité,
* expérience mobile.

### 5.5 Section fonctionnalités

Format en grille premium avec cartes sombres :

* site web restaurant premium,
* commande en ligne directe,
* gestion du menu,
* dashboard admin,
* centralisation des commandes,
* fidélisation / gamification,
* expérience mobile,
* accompagnement digital.

### 5.6 Section écosystème produit

Montrer les briques Be in Digital :

* storefront,
* dashboard,
* fidélité,
* analytics,
* menu digital,
* branding digital.

### 5.7 Section bénéfices

Traduire les fonctionnalités en gains concrets :

* plus de contrôle,
* meilleure image,
* plus de commandes directes,
* gain de temps,
* meilleure expérience client,
* outils centralisés.

### 5.8 Section réassurance

Mettre en avant :

* spécialisation restauration,
* approche sur mesure,
* accompagnement humain,
* design premium,
* vision business,
* stack moderne.

### 5.9 CTA final

Section immersive, simple, lisible et très claire, avec un bouton principal bien visible.

### 5.10 Footer

Footer fort visuellement, immersif, recoloré selon le branding mint / dark, avec liens utiles et contact.

---

## 6. Système de composants

Composants principaux :

* `Navbar`
* `HeroSection`
* `SectionBadge`
* `SectionHeader`
* `FeatureCard`
* `BenefitCard`
* `ProblemCard`
* `ProductShowcase`
* `MockupFrame`
* `GlowBackground`
* `CTASection`
* `Footer`

### Règles communes

* border radius généreux,
* spacing premium,
* fond sombre multi-couches,
* bordures très subtiles,
* ombres diffuses,
* glow mint très maîtrisé,
* cohérenc
