# Constitution du corpus Lunette Ronde

Le corpus sert à tester Lunette Ronde sur des textes longs réels sans construire une infrastructure de benchmark.

Le but n'est pas d'obtenir un échantillon statistiquement représentatif de toute la littérature. Il faut surtout conserver suffisamment de variété pour révéler les dérives du lecteur éditorial.

## 1. Commencer petit

### Premier jeu : 12 passages

Prendre 3 textes différents et 4 passages par texte :

- 1 passage fort ;
- 1 passage faible ;
- 1 passage ambigu ou difficile ;
- 1 passage ordinaire.

Ces 12 passages deviennent le jeu d'ancrage.

### Première baseline : 30 passages

Étendre ensuite à environ 5 textes différents et 30 passages.

Une répartition pratique :

| Profil | Nombre indicatif |
|---|---:|
| `strong` | 8 |
| `weak` | 8 |
| `ambiguous` | 6 |
| `ordinary` | 4 |
| `technical` | 4 |

Les nombres sont des repères, pas une obligation.

Si AutoEssay et AutoFiction sont tous deux évalués, viser approximativement 15 passages de chaque produit.

## 2. Taille des passages

Taille recommandée : environ 800 à 1 500 mots.

Un passage doit être assez long pour montrer :

- une progression de pensée ou de scène ;
- plusieurs phrases et rythmes ;
- des transitions ;
- éventuellement un rapport entre exposition et conséquence.

Mais il doit rester suffisamment borné pour qu'un finding puisse être relié à un contexte identifiable.

Ne pas couper :

- une phrase ;
- une citation en cours ;
- un dialogue au milieu d'un échange si cela change son sens ;
- un raisonnement juste avant l'élément qui le résout.

Lorsque la frontière naturelle dépasse un peu 1 500 mots, conserver la cohérence plutôt que respecter artificiellement la taille.

## 3. Profils de passage

### `strong`

Passage que vous jugez réussi et que vous voulez protéger.

Choisir notamment des passages avec :

- voix marquée ;
- syntaxe atypique mais fonctionnelle ;
- rythme travaillé ;
- ellipse ;
- ambiguïté productive ;
- image qui n'a pas besoin d'être expliquée ;
- précision technique dense mais nécessaire.

Ces passages testent la capacité de Lunette Ronde à ne pas sur-corriger.

### `weak`

Passage où vous savez qu'un problème existe.

Exemples :

- répétition ;
- abstraction sans référent ;
- enchaînement causal insuffisant ;
- sur-explication ;
- transition formulaire ;
- formulation qui masque une hésitation ;
- phrase complexe qui cache une pensée encore mal maîtrisée.

Ces passages testent la capacité de détection.

### `ambiguous`

Passage où une correction honnête nécessite une décision d'auteur ou une information absente.

Exemples :

- référent volontairement incomplet ;
- intention narrative non explicitée ;
- contradiction peut-être productive ;
- information retenue au lecteur ;
- formulation documentaire dont le niveau de certitude dépend d'une source externe.

Ces passages testent surtout `open_question` et `keep`.

### `ordinary`

Passage ni particulièrement fort, ni volontairement défectueux.

Il permet de vérifier que Lunette Ronde ne doit pas produire artificiellement des findings sur chaque unité.

### `technical`

Passage où la précision prime sur la simplicité :

- concept scientifique ;
- argument historique ;
- définition ;
- donnée ou chiffre ;
- passage documentaire ;
- description de mécanisme ;
- exposition structurée nécessaire.

Ces passages testent l'invariant : une phrase plus courte mais moins exacte est une mauvaise correction.

## 4. Échantillonner un texte long

Pour un livre, une longue enquête ou un manuscrit, ne choisir pas uniquement les pages qui vous préoccupent.

Prélever au minimum :

- un passage proche du début ;
- un passage du premier tiers ;
- un passage du milieu ;
- un passage du dernier tiers ;
- un passage proche de la fin ;
- un passage choisi pour une propriété particulière : très fort, faible, ambigu ou technique.

Cette dispersion permet de repérer une dérive qui n'apparaît pas au même endroit du texte.

## 5. Corpus AutoEssay

Inclure différentes fonctions argumentatives et documentaires.

Chercher notamment des passages avec :

- citations ;
- distinction fait / interprétation ;
- prudence épistémique ;
- plusieurs sources ou points de vue ;
- transitions argumentatives ;
- synthèses ;
- contradictions conservées ;
- passages conceptuellement denses.

Au moins quelques passages doivent être volontairement prudents afin de vérifier que Lunette Ronde ne transforme pas la nuance en certitude.

## 6. Corpus AutoFiction

Inclure différentes fonctions narratives.

Chercher notamment :

- dialogue ;
- description ;
- action ;
- intériorité ;
- focalisation marquée ;
- silence ou information retenue ;
- rupture de rythme ;
- passage de voix particulièrement singulier ;
- scène où le lecteur sait moins que certains personnages ;
- scène où une étrangeté syntaxique sert la perception ou l'émotion.

Au moins quelques passages doivent être difficiles mais réussis afin de tester `keep`.

## 7. Jeu d'ancrage

Le jeu d'ancrage est la partie la plus importante du corpus de calibration.

Conserver 12 passages :

- 4 forts ;
- 4 faibles ;
- 4 ambigus.

Règles :

- ne pas modifier leur texte pendant une comparaison ;
- conserver leur `passage_id` ;
- rejouer le même mode ;
- conserver autant que possible le même modèle ;
- conserver les anciennes annotations ;
- ne pas remplacer un passage difficile par un passage plus facile parce que Lunette Ronde y échoue.

Si le manuscrit évolue réellement, créer un nouvel identifiant de passage au lieu d'écraser silencieusement l'ancrage précédent.

## 8. Ne pas biaiser le corpus

Éviter les corpus composés uniquement de :

- mauvais textes ;
- prose générée par IA ;
- textes volontairement gonflés ;
- phrases artificiellement fabriquées pour déclencher une catégorie ;
- passages d'un seul auteur ou d'un seul registre si l'outil doit être plus général.

Un tel corpus apprendrait surtout à Lunette Ronde à trouver des défauts partout.

Le corpus doit contenir des endroits où la meilleure réponse est :

```text
findings: []
```

ou :

```text
keep
```

## 9. Utiliser ses propres textes

Pour la préservation de voix, vos propres textes sont généralement les plus informatifs parce que vous connaissez :

- ce qui est volontaire ;
- ce qui est accidentel ;
- les tensions que vous souhaitez conserver ;
- les endroits où la formulation a déjà été beaucoup travaillée ;
- les ambiguïtés qui doivent rester ouvertes.

Des textes externes peuvent ensuite élargir le test, mais ils ne remplacent pas cette connaissance d'auteur.

## 10. Vie privée et droits

Pour un corpus interne :

- privilégier vos propres textes ou des textes dont vous avez le droit d'usage ;
- éviter de déposer inutilement des manuscrits confidentiels dans un dépôt public ;
- si le dépôt est partagé, ne versionner que les métadonnées ou des identifiants lorsque le texte doit rester privé ;
- le CSV d'annotation peut référencer un `passage_id` sans contenir tout le manuscrit.

Le corpus de calibration n'a pas besoin d'être publié pour être utile.

## 11. Quand ajouter un nouveau passage

Ajouter un passage lorsqu'il apporte une difficulté qui n'est pas déjà bien couverte :

- nouveau registre ;
- nouveau type de voix ;
- nouvelle forme d'ambiguïté ;
- problème documentaire différent ;
- faux positif observé en production ;
- cas `dangerous` ;
- réussite particulièrement importante à protéger.

Éviter d'ajouter dix passages presque identiques uniquement pour gonfler le corpus.

## 12. Quand retirer un passage

Retirer ou remplacer un passage seulement s'il :

- est devenu inutilisable pour des raisons de droits ou confidentialité ;
- était mal extrait au point que son contexte est trompeur ;
- duplique exactement un autre cas sans ajouter d'information.

Ne pas retirer un passage parce que Lunette Ronde y obtient de mauvais résultats : un cas difficile stable est précisément utile pour mesurer le progrès.
