# PDF Flipbook

Générateur de flipbook interactif à partir d'un PDF — application web 100% statique.

## Fonctionnalités

- **Effet 3D réaliste** — pages qui se tournent avec ombres dynamiques
- **Liens cliquables** — QR codes et hyperliens du PDF conservés (externes + internes)
- **Sommaire** — table des matières extraite du PDF, navigation directe
- **Miniatures** — aperçu visuel de toutes les pages
- **Zoom** — de 50% à 250%
- **Plein écran** — immersion totale
- **Export HTML** — génère un fichier `.html` autonome partageable
- **Raccourcis clavier** — `←` `→` navigation, `F` plein écran, `T` sidebar

## Utilisation

### Pour les visiteurs

Le flipbook se charge automatiquement avec le PDF par défaut (`document.pdf`). Aucune action requise.

### Partager un PDF spécifique

Ajoutez le paramètre `?pdf=` à l'URL :

```
https://jeanmarc974.github.io/pdf-flipbook/?pdf=mon-document.pdf
https://jeanmarc974.github.io/pdf-flipbook/?pdf=https://exemple.com/document.pdf
```

### Charger son propre PDF

Glissez-déposez un fichier PDF sur la zone d'accueil, ou cliquez pour parcourir.

### Définir le PDF par défaut

Placez votre fichier PDF à la racine du projet sous le nom `document.pdf` :

```
pdf-flipbook/
├── document.pdf    ← votre PDF par défaut
├── index.html
├── css/
└── js/
```

Pushez sur GitHub — le PDF sera automatiquement chargé pour tous les visiteurs.

> **Note** : GitHub limite la taille des fichiers à 100 Mo. Pour les PDF volumineux, utilisez Git LFS ou un lien externe via `?pdf=URL`.

## Technologies

- [pdf.js](https://mozilla.github.io/pdf.js/) — rendu PDF et extraction des annotations
- [PageFlip](https://github.com/Nodlik/StPageFlip) — effet flipbook 3D
- HTML/CSS/JS vanilla — aucun build, aucune dépendance npm

## Structure

```
├── index.html       # UI principale
├── css/style.css    # Styles
├── js/app.js        # Logique applicative
└── .gitignore
```

## Déploiement

L'application est déployée sur GitHub Pages — c'est un site statique, aucun serveur requis.

## Licence

MIT
