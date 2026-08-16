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

1. Ouvrez le site dans un navigateur
2. Glissez-déposez un fichier PDF (ou cliquez pour parcourir)
3. Naviguez avec les flèches, la sidebar, ou le clavier
4. Exportez en HTML autonome si souhaité

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
