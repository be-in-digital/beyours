#!/bin/bash

# Script pour copier les fonctions Convex vers une app Next.js
# Usage: ./scripts/copy-to-app.sh <app-name>
# Exemple: ./scripts/copy-to-app.sh restaurant-theme

set -e

APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "❌ Erreur: Nom de l'app requis"
  echo "Usage: ./scripts/copy-to-app.sh <app-name>"
  echo "Exemple: ./scripts/copy-to-app.sh restaurant-theme"
  exit 1
fi

# Chemins
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PACKAGE_DIR/../../apps/$APP_NAME"
CONVEX_DIR="$APP_DIR/convex"

# Vérifier que l'app existe
if [ ! -d "$APP_DIR" ]; then
  echo "❌ Erreur: L'app '$APP_NAME' n'existe pas dans apps/"
  echo "Chemin recherché: $APP_DIR"
  exit 1
fi

# Créer le dossier convex/ si nécessaire
if [ ! -d "$CONVEX_DIR" ]; then
  echo "📁 Création du dossier convex/"
  mkdir -p "$CONVEX_DIR"
fi

echo "📦 Copie des fonctions Convex vers $APP_NAME..."
echo ""

# Copier tous les fichiers .ts sauf index.ts et les tests
FILES_COPIED=0
for file in "$PACKAGE_DIR"/src/*.ts; do
  filename=$(basename "$file")

  # Ignorer index.ts (barrel file)
  if [ "$filename" = "index.ts" ]; then
    continue
  fi

  # Copier le fichier
  cp "$file" "$CONVEX_DIR/$filename"
  echo "✅ Copié: $filename"
  FILES_COPIED=$((FILES_COPIED + 1))
done

echo ""
echo "✨ Terminé! $FILES_COPIED fichiers copiés vers $CONVEX_DIR"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Définir le schema dans $CONVEX_DIR/schema.ts"
echo "  2. Lancer 'npx convex dev' pour générer les types"
echo "  3. Utiliser les fonctions dans votre app avec 'api.stores.list', etc."
