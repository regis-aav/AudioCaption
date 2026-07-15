# Architecture de l’export HTML et de la personnalisation de marque

## Objectif

L’export AudioCaption produit un épisode autonome, prêt à être déposé sur un hébergement web classique.

Le dossier exporté contient uniquement ce qui est nécessaire à la consultation de l’épisode. Il ne dépend ni d’AudioCaption Studio, ni d’un serveur applicatif, ni d’un service tiers obligatoire.

Cette architecture doit rester simple à comprendre, facile à déplacer et durable dans le temps.

## 1. Structure du dossier exporté

```text
episode/
├── index.html
├── css/
│   └── player.css
├── js/
│   └── player.js
├── media/
│   ├── artwork.webp
│   ├── episode.mp3
│   └── captions.vtt
├── fonts/                 # Facultatif
│   ├── body.woff2
│   └── headings.woff2
└── README.txt
```

Principes de structure :

- tous les chemins sont relatifs à `index.html` ;
- les noms de fichiers générés sont prévisibles et indépendants des noms d’origine ;
- le dossier `fonts/` n’est créé que si des polices auto-hébergées sont utilisées ;
- aucun fichier propre à l’interface Studio n’est exporté ;
- `README.txt` explique comment publier et tester le dossier.

Le premier format d’export ne nécessite pas de fichier de métadonnées séparé. Les métadonnées utiles au lecteur sont injectées dans `index.html` sous forme de données JSON non exécutables et de contenu HTML accessible. Cette approche évite une requête supplémentaire et les restrictions rencontrées lors de l’ouverture locale d’un fichier JSON.

Un fichier `metadata.json` pourra être ajouté ultérieurement si une API publique ou l’intégration dans d’autres outils le justifie.

## 2. Ressources intégrées

### HTML

`index.html` contient :

- la structure sémantique de l’épisode ;
- les métadonnées essentielles ;
- les références relatives aux styles, au runtime et aux médias ;
- un contenu de repli lisible si JavaScript est indisponible ;
- les informations de langue et d’accessibilité.

### CSS

`css/player.css` contient :

- la mise en page du lecteur exporté ;
- les styles responsive ;
- les états clavier et les règles d’accessibilité visuelle ;
- les variables du thème choisi ;
- les déclarations `@font-face` uniquement lorsque des polices sont embarquées.

### JavaScript

`js/player.js` est un runtime de lecture minimal. Il gère le lecteur, la progression, le volume, la transcription et la recherche.

Il ne contient aucune fonction d’édition, d’import ou d’export issue du Studio.

### Illustration

L’illustration est copiée dans `media/`. Une conversion vers WebP peut être proposée, sans supprimer la possibilité de conserver le format original lorsque la conversion dégrade le résultat ou n’est pas disponible.

### Audio

Le fichier audio est copié sans réencodage par défaut. L’export ne doit pas modifier silencieusement sa qualité.

### Transcription

La transcription est exportée en WebVTT normalisé. Le fichier source peut rester inchangé dans le projet Studio, mais l’épisode publié dispose d’un format unique et adapté au Web.

### Métadonnées

Le socle minimal comprend :

- le titre ;
- la description ;
- l’auteur ;
- la durée ;
- la langue ;
- les chemins de l’illustration, de l’audio et de la transcription ;
- les informations de thème nécessaires à la restitution.

Les textes injectés doivent être échappés avant l’export. Les données ne doivent jamais être transformées en code JavaScript exécutable.

## 3. Fonctionnement autonome

L’épisode exporté doit fonctionner après copie du dossier sur un serveur HTTP statique : hébergement mutualisé, stockage objet, dépôt Git publié ou serveur local classique.

Le runtime ne doit exiger :

- aucun appel à AudioCaption Studio ;
- aucune base de données ;
- aucun outil de compilation côté hébergeur ;
- aucune ressource distante obligatoire ;
- aucun cookie ni mécanisme de suivi.

Les chemins relatifs permettent de déplacer ou renommer le dossier complet sans reconstruire l’épisode.

L’ouverture directe de `index.html` depuis le système de fichiers peut être proposée comme confort, mais le fonctionnement garanti cible un hébergement HTTP. Certains navigateurs restreignent en effet le chargement local des fichiers audio ou WebVTT.

## 4. Personnalisation de marque

La personnalisation repose sur un contrat limité de variables CSS sémantiques :

```css
:root {
  --ac-accent: #34c759;
  --ac-accent-strong: #2fb344;
  --ac-page-background: #f3f6f3;
  --ac-card-background: #ffffff;
  --ac-text-primary: #171917;
  --ac-text-secondary: #667069;
  --ac-font-body: system-ui, sans-serif;
  --ac-font-headings: system-ui, sans-serif;
}
```

Ces variables constituent une API visuelle stable. Les composants du lecteur consomment uniquement ces rôles et ne connaissent pas le nom commercial d’un thème.

Lors de l’export :

1. le Studio part des valeurs du thème sélectionné ;
2. il applique les valeurs personnalisées autorisées ;
3. il valide le format des couleurs et des familles typographiques ;
4. il contrôle les combinaisons de contraste ;
5. il écrit les valeurs finales dans le bloc `:root` de `css/player.css`.

Le fichier exporté ne dépend donc pas d’un moteur de thème au moment de la consultation.

Les réglages restent volontairement limités. La structure, les espacements, les états interactifs et la hiérarchie typographique ne sont pas personnalisables dans la première version.

## 5. Stratégies de polices

### Polices système — stratégie par défaut

Une pile de polices système est utilisée sans téléchargement supplémentaire.

C’est la solution la plus rapide, la plus robuste et la plus respectueuse de la vie privée. Elle doit rester le choix par défaut du thème AudioCaption.

### Polices web auto-hébergées

L’utilisateur peut fournir des fichiers compatibles, idéalement au format WOFF2.

Ils sont copiés dans `fonts/`, référencés avec des chemins relatifs et déclarés avec `font-display: swap`. Le nombre de familles, de graisses et de variantes doit être limité pour contenir le poids de l’export.

Le Studio doit rappeler à l’utilisateur qu’il lui appartient de disposer des droits de diffusion nécessaires.

### URL externe — option explicite

Une URL de feuille de style ou de police peut être proposée comme option avancée.

Ce choix rompt l’autonomie complète, peut transmettre des données à un tiers et rend le rendu dépendant du réseau. Il doit donc être désactivé par défaut, clairement signalé et accompagné d’une police système de repli.

## 6. Architecture des thèmes

Un thème est un ensemble versionné de valeurs respectant le contrat de variables CSS.

Trois niveaux sont prévus :

1. **Thème AudioCaption par défaut** : maintenu avec le produit et utilisé sans configuration.
2. **Thème personnalisé** : copie du thème de base avec un nombre limité de valeurs remplacées.
3. **Thèmes prédéfinis futurs** : ensembles nommés utilisant le même contrat, sans modifier les composants.

Dans le Studio, un thème peut être représenté par un objet de configuration. Dans l’export, seules les valeurs CSS résolues sont conservées. Le fichier publié reste ainsi indépendant du format interne du Studio.

Toute évolution du contrat doit être versionnée. Une nouvelle variable dispose toujours d’une valeur de repli afin que les anciens thèmes restent utilisables.

## 7. Limites à respecter

La personnalisation ne doit pas devenir un constructeur de page.

Le premier périmètre exclut notamment :

- le déplacement libre des composants ;
- l’ajout de CSS arbitraire depuis l’interface ;
- le choix individuel de toutes les tailles et marges ;
- la multiplication des couleurs d’accent ;
- les animations configurables ;
- les scripts personnalisés.

Chaque réglage doit préserver :

- la cohérence de l’interface ;
- la navigation clavier ;
- la lisibilité des états ;
- les contrastes minimums ;
- `prefers-reduced-motion` ;
- le responsive ;
- un poids d’export raisonnable.

Une personnalisation refusée pour des raisons de contraste ou de format doit être expliquée clairement dans le Studio.

## 8. Questions techniques ouvertes

### Copie ou référence des médias

**Orientation recommandée :** copier les médias dans l’export afin de garantir sa portabilité.

**Arbitrage nécessaire :** faut-il proposer plus tard un mode avancé utilisant des URL existantes pour les fichiers très volumineux ?

### Export ZIP

**Orientation recommandée :** générer un ZIP contenant directement le dossier publiable.

**Arbitrage nécessaire :** génération intégralement dans le navigateur ou traitement délégué à un environnement serveur pour les épisodes volumineux ?

### Polices personnalisées

**Orientation recommandée :** accepter WOFF2 en priorité et limiter le nombre de fichiers.

**Arbitrage nécessaire :** formats autorisés, poids maximal, nombre de graisses et responsabilité de la licence.

### Validation des contrastes

**Orientation recommandée :** vérifier automatiquement les couples texte/fond avant l’export et bloquer les combinaisons manifestement non conformes.

**Arbitrage nécessaire :** appliquer strictement WCAG AA ou autoriser un avertissement pour certains éléments décoratifs non textuels ?

### Stockage des préférences de marque

**Orientation recommandée :** conserver localement les préférences dans le Studio et permettre leur export sous forme de configuration réutilisable.

**Arbitrage nécessaire :** stockage navigateur uniquement, fichier de thème importable, ou synchronisation liée à un compte dans une version future ?

### Conversion des ressources

**Orientation recommandée :** ne jamais réencoder l’audio implicitement et rendre toute optimisation d’image explicite.

**Arbitrage nécessaire :** faut-il imposer WebP, conserver systématiquement l’original ou proposer les deux dans l’export ?

## Décisions structurantes

- L’export est un dossier statique et autonome.
- Le lecteur exporté utilise un runtime distinct et minimal.
- Les médias sont locaux par défaut.
- Les métadonnées essentielles sont injectées dans le HTML.
- Le thème est résolu lors de l’export et écrit dans les variables CSS.
- Les polices système constituent le comportement par défaut.
- La personnalisation reste encadrée par un petit contrat visuel.
- L’accessibilité, la confidentialité et le poids de l’export priment sur la liberté de mise en page.
