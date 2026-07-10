# Contribuer à AudioCaption

Merci de contribuer à AudioCaption. Le projet cherche à rester simple, accessible et sobre : chaque évolution doit préserver ces qualités.

## Avant de commencer

- Consultez les issues existantes et décrivez le besoin avant d'engager une évolution importante.
- Travaillez sur une branche dédiée et limitez chaque pull request à un objectif précis.
- Ne modifiez pas des fichiers hors du périmètre annoncé sans l'expliquer au préalable.
- Préservez les fonctionnalités existantes, notamment la lecture audio, les sous-titres synchronisés et la transcription cliquable.

## Principes de contribution

- Préférez les API natives du navigateur et n'ajoutez pas de dépendance sans justification explicite.
- Écrivez du HTML sémantique, des contrôles utilisables au clavier et des libellés compréhensibles par les technologies d'assistance.
- Gardez le JavaScript court, explicite et sans abstraction prématurée.
- Évitez les effets visuels ou requêtes réseau qui n'apportent pas une valeur directe à l'écoute.
- Respectez la langue et le ton déjà choisis dans l'interface ; signalez toute évolution de contenu ou de localisation.

## Préparer une pull request

Une pull request doit :

1. Décrire le problème traité et l'approche retenue.
2. Indiquer les fichiers modifiés et les risques de régression éventuels.
3. Vérifier la lecture/pause, la progression, le volume, le chargement des médias, les sous-titres et le clic sur une ligne de transcription lorsque ces éléments sont concernés.
4. Vérifier le rendu sur mobile et grand écran, ainsi que la navigation au clavier pour toute évolution d'interface.
5. Rester lisible et suffisamment petite pour être revue facilement.

## Qualité et accessibilité

Avant de proposer une modification, vérifiez qu'elle ne génère pas d'erreur dans la console et qu'elle fonctionne dans les navigateurs modernes. Utilisez `textContent` pour afficher le contenu des sous-titres, afin de ne pas interpréter un texte importé comme du HTML.

Les corrections de bugs, améliorations d'accessibilité et réductions de poids sont toujours bienvenues. Pour une fonctionnalité plus large, ouvrez d'abord une issue afin de valider le besoin et le périmètre.

## Licence

En contribuant, vous acceptez que votre contribution soit distribuée sous la licence MIT du projet.
