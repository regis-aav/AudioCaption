# Spécification conceptuelle du modèle Episode

## Portée du document

Ce document définit l’objet central d’AudioCaption : `Episode`.

Il décrit un modèle conceptuel commun au Studio, au lecteur, au moteur d’export et aux futurs services. Il ne constitue pas encore un schéma JSON définitif, une API ni une structure de base de données.

La priorité de la V1 est un modèle simple, compréhensible et sérialisable.

## 1. Pourquoi Episode est l’objet central

AudioCaption ne manipule pas seulement une image, un fichier audio et une transcription. Il prépare une publication cohérente qui réunit ces ressources, leur contexte éditorial et leur présentation.

Cette publication est un `Episode`.

Le Studio crée et modifie un Episode. Le lecteur reçoit un Episode et l’affiche. Le moteur d’export transforme un Episode en dossier autonome. Les futurs outils d’enrichissement produiront des informations rattachées à un Episode. Les outils d’analyse utiliseront son identifiant pour rapprocher les données d’un même contenu.

Ce modèle commun évite que chaque partie du projet reconstruise sa propre représentation du contenu. Il fournit une source de vérité unique, indépendante de l’écran qui la manipule.

L’interface doit donc répondre à la question « quel est l’état de l’épisode ? », et non gérer trois fichiers sans relation entre eux.

### Brouillon et épisode exportable

Un Episode peut exister dès le début de l’import. Il peut alors être incomplet et rester un brouillon.

Pour être exportable en V1, il doit disposer :

- d’un visuel valide ;
- d’un fichier audio valide ;
- d’une transcription valide ;
- d’un titre ;
- d’une langue principale ;
- d’un thème valide.

Cette distinction permet de sauvegarder un travail en cours sans affaiblir les règles de validation de l’export.

## 2. Modèle conceptuel

```text
Episode
  id
  modelVersion
  status

  metadata
    title
    description
    author
    language
    publishedAt

  media
    artwork
    audio
    captions

  brand
    name
    logo

  presentation
    theme
    accentColor
    accentStrongColor
    bodyFont
    headingFont

  accessibility
    transcriptLanguage

  analytics
    trackingId

  export
    slug
    format
```

Cette organisation sépare quatre responsabilités :

- `metadata` décrit le contenu ;
- `media` référence les ressources nécessaires à sa lecture ;
- `brand` décrit l’identité éditoriale ;
- `presentation` indique comment cette identité est appliquée au lecteur.

La séparation entre `brand` et `presentation` évite de confondre l’identité d’un éditeur avec un réglage propre à une interface. En V1, ces sections restent volontairement petites.

`analytics` et `export` sont présents comme points d’extension. Ils ne doivent pas devenir des conteneurs génériques où stocker des états techniques.

## 3. Propriétés

### Racine de l’Episode

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `id` | Identifier durablement l’épisode entre le Studio, les exports et les publications. | Chaîne | Obligatoire | Générée à la création | Non vide, stable, unique dans le périmètre du Studio. Le format exact reste à arbitrer. |
| `modelVersion` | Indiquer la version du modèle utilisée pour sérialiser l’épisode. | Chaîne de version | Obligatoire | Version courante de la V1 | Format versionné et reconnu par le lecteur de projet. Ne décrit pas la version éditoriale du contenu. |
| `status` | Distinguer un travail en cours d’un épisode prêt à publier. | Valeur contrôlée | Obligatoire | `draft` | Valeurs V1 proposées : `draft` et `ready`. Le statut `ready` doit être calculable à partir des validations, pas seulement déclaré par l’interface. |

### `metadata`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `title` | Nom éditorial de l’épisode. | Texte | Obligatoire pour l’export | Nom du fichier audio sans extension lors du premier import | Texte non vide après suppression des espaces superflus. Longueur maximale à définir. |
| `description` | Présenter brièvement le contenu. | Texte | Optionnelle | Aucune | Texte brut. Le rendu ne doit pas interpréter de HTML non contrôlé. |
| `author` | Identifier la personne ou l’organisation responsable du contenu. | Texte | Optionnelle | Aucune | Texte brut, sans supposer qu’il s’agit d’une personne unique. |
| `language` | Décrire la langue principale parlée dans l’épisode. | Code de langue BCP 47 | Obligatoire pour l’export | Langue choisie dans le Studio | Code valide, par exemple `fr`, `fr-FR` ou `en`. |
| `publishedAt` | Indiquer la date de publication éditoriale. | Date et heure | Optionnelle | Aucune | Représentation ISO 8601 lors de la sérialisation. Le fuseau doit être explicite lorsque l’heure est renseignée. |

L’absence de `publishedAt` signifie que l’épisode n’a pas encore de date de publication connue. Elle ne doit pas être remplacée automatiquement par la date d’import.

### `media`

Les trois propriétés utilisent le concept commun de **référence de ressource**. Une référence décrit une ressource sans imposer immédiatement sa représentation technique.

Une référence de ressource contient au minimum :

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `name` | Conserver un nom lisible pour la ressource. | Texte | Obligatoire si la ressource existe | Nom du fichier importé | Nom sûr, sans chemin absolu. |
| `mediaType` | Décrire le format réel. | Type MIME | Obligatoire si connu | Détecté à l’import | Doit être compatible avec la catégorie de ressource. |
| `size` | Connaître le poids du fichier. | Entier en octets | Optionnelle | Aucune | Nombre positif ou nul. |
| `reference` | Permettre au Studio ou à l’exporteur de retrouver les données binaires. | Référence abstraite | Obligatoire si la ressource existe | Aucune | Ne doit pas exposer un chemin local absolu dans un document sérialisé. Sa forme définitive reste à arbitrer. |

Les propriétés de `media` sont :

| Propriété | Rôle | Présence dans un brouillon | Règles pour l’export V1 |
|---|---|---|---|
| `artwork` | Illustration principale de l’épisode. | Optionnelle | Obligatoire. Image JPEG, PNG ou WebP valide. Une seule illustration principale. |
| `audio` | Contenu sonore principal. | Optionnelle | Obligatoire. Format lisible par les navigateurs ciblés. Une seule piste audio. La durée doit pouvoir être déterminée. |
| `captions` | Transcription synchronisée avec l’audio. | Optionnelle | Obligatoire. SRT ou WebVTT accepté à l’import, WebVTT recommandé pour l’export. Les cues doivent contenir des timestamps valides. |

Les données binaires ne font pas nécessairement partie de l’objet sérialisé lui-même. Le modèle conserve une référence logique ; une couche de stockage du Studio ou le moteur d’export résout cette référence.

### `brand`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `name` | Nom de la marque, de l’éditeur ou de la collection. | Texte | Optionnelle | Aucune | Texte court et non vide lorsqu’il est renseigné. |
| `logo` | Ressource graphique associée à la marque. | Référence de ressource | Optionnelle | Aucune | Image valide. Non utilisée dans l’interface V1 tant que son emplacement n’est pas défini. |

La marque décrit une identité. Elle ne contient pas de dimensions, de positions ni d’état d’affichage.

### `presentation`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `theme` | Choisir un ensemble cohérent de valeurs visuelles. | Identifiant de thème | Obligatoire | Thème AudioCaption par défaut | Identifiant connu ou thème personnalisé valide. |
| `accentColor` | Définir la couleur d’action principale. | Couleur CSS normalisée | Optionnelle | Valeur du thème | Format de couleur autorisé et contraste validé dans ses usages. |
| `accentStrongColor` | Définir la variante renforcée de l’accent. | Couleur CSS normalisée | Optionnelle | Valeur du thème | Même validation que l’accent principal. |
| `bodyFont` | Définir la famille utilisée pour le texte courant. | Référence typographique | Optionnelle | Pile de polices système | Valeur issue d’une liste autorisée ou ressource auto-hébergée valide. |
| `headingFont` | Définir la famille utilisée pour les titres. | Référence typographique | Optionnelle | Identique à `bodyFont` | Même validation que la police du texte. |

Les valeurs de présentation sont des préférences éditoriales sérialisables. Les éléments temporaires tels qu’un panneau ouvert, un focus, une position de lecture ou un état de survol n’en font jamais partie.

### `accessibility`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `transcriptLanguage` | Décrire la langue de la transcription. | Code de langue BCP 47 | Obligatoire lorsque la transcription existe | Valeur de `metadata.language` | Code valide. Peut différer de la langue audio dans de futures versions traduites. |

En V1, cette section reste limitée. L’accessibilité ne doit pas être réduite à des options : la structure sémantique, le clavier et les contrastes restent des obligations du lecteur et de l’exporteur.

### `analytics`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `trackingId` | Rattacher ultérieurement des événements à un Episode sans inclure les mesures dans le modèle éditorial. | Chaîne | Optionnelle, hors V1 | Aucune | Identifiant non sensible et indépendant d’un fournisseur lorsque cela est possible. |

Les statistiques collectées ne sont pas stockées dans l’Episode. Elles l’analysent depuis un système séparé. Aucun suivi n’est activé par défaut.

### `export`

| Propriété | Rôle | Type conceptuel | Présence | Valeur par défaut | Validation |
|---|---|---|---|---|---|
| `slug` | Proposer un nom stable et sûr pour le dossier ou l’URL de publication. | Chaîne | Optionnelle | Dérivée du titre | Caractères sûrs pour une URL, sans séparateur de chemin. |
| `format` | Identifier la cible d’export. | Valeur contrôlée | Optionnelle | `html-folder` | V1 : `html-folder`. De nouvelles destinations pourront être ajoutées sans changer les données éditoriales. |

Les chemins de fichiers produits ne sont pas des données éditoriales. Ils sont calculés par le moteur d’export et restent relatifs à la racine du dossier exporté.

## 4. Cycle de vie

```text
Importer → Créer un Episode → Prévisualiser → Exporter → Publier
```

### Importer

Le Studio reçoit des fichiers choisis ou déposés par l’utilisateur. Il vérifie leur type et collecte les informations disponibles : nom, taille, durée, dimensions et langue renseignée.

### Créer un Episode

Le Studio crée un Episode dès que le travail commence. Chaque fichier valide alimente une propriété de `media`. Le nom du fichier audio peut initialiser le titre, sans empêcher sa modification ultérieure.

À partir de ce moment, l’interface manipule l’Episode. Elle ne maintient pas trois modèles concurrents pour l’image, l’audio et la transcription.

### Prévisualiser

Le lecteur reçoit l’Episode et résout ses références de ressources. Il affiche les métadonnées et applique la présentation sans écrire d’état de lecture dans le modèle.

La position audio, le cue actif, la recherche courante et l’ouverture des cartes d’import sont des états d’interface temporaires.

### Exporter

Le moteur vérifie que l’Episode satisfait le profil d’export V1. Il transforme ensuite le modèle en HTML, CSS, JavaScript et ressources locales.

Il ne modifie pas l’Episode pour refléter les chemins internes du dossier généré. La correspondance entre références sources et chemins relatifs appartient au processus d’export.

### Publier

Le dossier exporté est déposé sur un hébergement. Une publication peut être associée à l’identifiant de l’Episode, mais son URL et son état de déploiement ne doivent pas être confondus avec l’état temporaire du Studio.

## 5. Principes d’architecture

### Indépendance du DOM

Un Episode ne contient aucun élément DOM, sélecteur CSS, gestionnaire d’événement ni référence vers un composant d’interface.

### Aucun état d’interface

Un Episode ne stocke pas la position de lecture courante, le cue actif, la valeur d’un champ non validé, le focus, un panneau ouvert ou un état de drag & drop.

### Sérialisation

Un Episode peut être converti en données persistantes puis restauré. Les objets propres au navigateur, tels que `File`, `Blob` ou une URL temporaire créée en mémoire, nécessitent une représentation ou un stockage séparé.

### Versionnement

Chaque Episode indique la version du modèle qu’il respecte. Cette version permet de valider les données et d’appliquer une migration explicite lorsque le modèle évolue.

### Chemins relatifs dans l’export

Le moteur d’export génère uniquement des chemins relatifs. Aucun chemin local du poste de l’utilisateur ne doit apparaître dans le dossier publié.

### Indépendance du Studio

Le modèle appartient au domaine AudioCaption, pas à une implémentation particulière du Studio. Un autre éditeur, un outil en ligne de commande ou un service d’import doit pouvoir produire un Episode compatible.

### Simplicité de la V1

La V1 privilégie un contenu principal unique, une validation compréhensible et peu de réglages. Un point d’extension futur n’est ajouté que s’il a une responsabilité claire.

## 6. V1 et évolutions futures

### Périmètre V1

La V1 comprend :

- un identifiant stable ;
- une version de modèle ;
- un titre et une langue principale ;
- une description et un auteur facultatifs ;
- un visuel principal ;
- un fichier audio principal ;
- une transcription synchronisée ;
- un thème AudioCaption ou une personnalisation de marque limitée ;
- un export HTML autonome.

Elle ne gère qu’une langue principale et une seule ressource de chaque catégorie.

### Évolutions compatibles envisagées

Ces évolutions ne sont pas implémentées par la présente spécification :

- **plusieurs langues** : ajout d’une liste de versions linguistiques liées à une langue principale ;
- **plusieurs transcriptions** : évolution de `captions` vers une collection de pistes identifiées par langue et usage ;
- **chapitres** : ajout d’une collection ordonnée avec titre et timestamp ;
- **résumé produit par IA** : ajout d’un enrichissement traçable, distinct de la description éditoriale validée ;
- **SEO** : ajout de métadonnées de publication sans les mélanger aux données nécessaires à la lecture ;
- **analytics** : association de mesures externes à l’identifiant de l’Episode ;
- **variantes de visuel** : collection de ressources avec rôle, dimensions et contexte d’utilisation ;
- **publications multiples** : collection de destinations et de résultats de publication séparée du contenu source.

Le passage d’une propriété unique à une collection doit être pris en charge par une migration de modèle. Il ne faut pas compliquer la V1 avec des tableaux contenant toujours un seul élément.

## 7. Questions ouvertes

### Génération et stabilité de l’identifiant

- Utiliser un UUID, un identifiant aléatoire plus court ou une autre forme ?
- L’identifiant est-il créé dès l’ouverture d’un nouveau projet ou au premier import valide ?
- Une duplication d’Episode doit-elle produire un nouvel identifiant ? L’orientation recommandée est oui.

### Format de version

- Utiliser un entier de schéma, une version sémantique ou une chaîne propre au projet ?
- Distinguer dès maintenant version du modèle et version éditoriale de l’Episode ?

### Représentation des fichiers

- Comment une référence de ressource est-elle sérialisée dans le Studio ?
- Les données binaires sont-elles conservées dans IndexedDB, dans un fichier de projet ou uniquement pendant la session ?
- Comment garantir qu’une référence reste résoluble après réouverture du projet ?
- Faut-il conserver le nom original en plus du nom normalisé pour l’export ?

### Stratégie multilingue

- Une langue correspond-elle à une transcription, à une version éditoriale complète ou aux deux ?
- Plusieurs langues partagent-elles le même audio ou peuvent-elles disposer de pistes différentes ?
- Quel élément porte la langue de référence ?

### Données éditoriales et présentation

- Les préférences de thème appartiennent-elles toujours à l’Episode ou peuvent-elles être héritées d’une marque partagée ?
- Lorsqu’un thème global évolue, un ancien Episode conserve-t-il ses valeurs résolues ou adopte-t-il la nouvelle version ?

### Migration du modèle

- Où résident les fonctions de migration ?
- Les migrations sont-elles appliquées à l’ouverture ou seulement lors de l’enregistrement ?
- Combien d’anciennes versions doivent rester lisibles ?
- Comment préserver une copie originale en cas d’échec de migration ?

### Statut et publication

- `ready` doit-il être stocké ou toujours calculé ?
- Faut-il distinguer plus tard `ready`, `exported` et `published`, ou conserver les résultats de publication dans un modèle séparé ?

## Décisions de modélisation retenues

- `Episode` est la source de vérité commune à tout AudioCaption.
- Un brouillon peut être incomplet ; l’export applique une validation plus stricte.
- Les métadonnées, les médias, la marque et la présentation ont des responsabilités distinctes.
- Les ressources sont représentées par des références abstraites, sans chemin local durable dans le modèle.
- Les états temporaires du lecteur et du Studio sont exclus.
- La V1 utilise une ressource principale par catégorie.
- Les données sont sérialisables et explicitement versionnées.
- Les chemins du dossier exporté sont générés et relatifs.
- Le modèle conceptuel précède et guide un futur format JSON, sans le figer aujourd’hui.
