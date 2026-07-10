# AudioCaption

> Where audio meets subtitles.

AudioCaption est un lecteur audio web léger qui associe un contenu sonore, une image et des sous-titres synchronisés. Il permet de publier une expérience éditoriale accessible sans devoir produire une vidéo.

## Aperçu

> **Capture à venir** — ajoutez une image de démonstration dans `docs/screenshot.png`, puis référencez-la ici.

## Fonctionnalités

- Lecture, pause, progression, durée et volume dans une interface personnalisée.
- Chargement local d’une image, d’un fichier audio et d’une transcription synchronisée.
- Sous-titres affichés sur la pochette pendant la lecture.
- Transcription cliquable pour se déplacer directement à un passage.
- Support du glisser-déposer pour charger plusieurs médias en une fois.
- Interface responsive, utilisable au clavier et attentive au réglage `prefers-reduced-motion`.
- Aucun framework ni dépendance JavaScript.

## Formats supportés

| Type | Formats |
| --- | --- |
| Image | JPG, JPEG, PNG, WebP |
| Audio | MP3, WAV, M4A, OGG, AAC, FLAC et formats pris en charge par le navigateur |
| Sous-titres | SRT, WebVTT (`.vtt`) |

Les paramètres de présentation WebVTT (`align`, `position`, `line`, `size`, etc.) sont ignorés pour préserver la synchronisation des timestamps.

## Installation

AudioCaption est un projet statique : aucun paquet n’est à installer.

```bash
git clone https://github.com/regis-aav/AudioCaption.git
cd AudioCaption
python3 -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000](http://localhost:8000) dans votre navigateur.

Vous pouvez également ouvrir `index.html` directement, mais un serveur local est recommandé pour reproduire les conditions normales d’un site web.

## Utilisation

1. Chargez ou déposez une image de couverture.
2. Chargez ou déposez un fichier audio compatible.
3. Chargez ou déposez un fichier SRT ou WebVTT.
4. Utilisez le bouton de lecture, la timeline ou une ligne de transcription pour naviguer dans le contenu.

Les contrôles s’activent automatiquement lorsque les métadonnées du fichier audio sont disponibles.

## Philosophie

AudioCaption défend une publication audio plus sobre et plus inclusive :

- l’audio et le texte sont privilégiés quand la vidéo n’apporte pas de valeur nécessaire ;
- l’accessibilité est considérée dès la conception ;
- les standards du web sont préférés aux solutions propriétaires ;
- chaque dépendance doit être justifiée par une valeur réelle et durable ;
- le code doit rester simple à lire, à modifier et à déployer.

## Roadmap

- [ ] Ajouter une capture d’écran et des exemples de médias.
- [ ] Mettre en place des tests automatisés pour le parsing et le lecteur.
- [ ] Affiner les messages d’erreur et les états de chargement.
- [ ] Documenter un mode d’intégration dans un site existant.
- [ ] Étudier des options d’export et de partage sans alourdir le lecteur.

## Contribution

Les contributions sont bienvenues. Privilégiez les petites pull requests, ciblées et documentées, qui préservent les fonctionnalités existantes et la sobriété du projet.

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les règles de contribution.

## Licence

AudioCaption est distribué sous licence [MIT](LICENSE).
