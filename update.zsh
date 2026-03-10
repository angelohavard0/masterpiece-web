#!/bin/zsh

SOURCE="/home/angelo/Documents/coure/chef_d_euvre/v2/web/pc/public"
DEST="/var/www/html"

# Parcours tous les fichiers
find "$SOURCE" -type f | while IFS= read -r file; do
    # Chemin relatif
    REL="${file#$SOURCE/}"
    # Crée les dossiers dans le dossier cible si nécessaire
    mkdir -p "$DEST/$(dirname "$REL")"
    # Copie le fichier
    cp "$file" "$DEST/$REL"
done

echo "Synchronisation terminée de $SOURCE vers $DEST"