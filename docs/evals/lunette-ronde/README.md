# Lunette Ronde — guide d'utilisation et de progression

Ce dossier permet d'évaluer et d'affiner Lunette Ronde sur des textes longs avec très peu d'outillage technique.

Le principe est volontairement simple : utiliser de vrais textes, conserver un petit jeu de passages fixes, annoter humainement les résultats, puis ne modifier qu'une chose à la fois.

Il ne s'agit pas d'un benchmark scientifique ni d'un score de « bonne écriture ». Le but est de répondre à quatre questions pratiques :

1. Lunette Ronde repère-t-elle des problèmes éditoriaux réellement utiles ?
2. Évite-t-elle les faux positifs, notamment sur les passages singuliers ou volontairement difficiles ?
3. Ses suggestions préservent-elles sens, précision, voix et intention ?
4. Sait-elle reconnaître quand elle doit poser une question ou ne rien toucher ?

## Le kit

- `PROTOCOL.md` : comment annoter chaque review et calculer les indicateurs utiles ;
- `CORPUS.md` : comment choisir des passages représentatifs dans des textes longs ;
- `annotation-template.csv` : tableau prêt à ouvrir dans Google Sheets, Excel ou LibreOffice Calc.

Aucun script n'est nécessaire pour commencer.

## Démarrage rapide — 15 minutes

1. Ouvrir `annotation-template.csv` dans Google Sheets ou Excel.
2. Choisir 3 textes que vous connaissez bien.
3. Prélever 4 passages dans chacun :
   - un passage que vous jugez réussi ;
   - un passage que vous jugez faible ;
   - un passage ambigu ou volontairement difficile ;
   - un passage ordinaire.
4. Utiliser des passages de 800 à 1 500 mots environ, sans couper une phrase en deux.
5. Lancer Lunette Ronde en mode `full` sur chaque passage.
6. Reporter chaque finding dans le tableau.
7. Pour chaque finding, choisir un verdict humain : `useful`, `false_positive`, `too_timid` ou `dangerous`.
8. Ne modifier ni le prompt, ni les catégories, ni le mode pendant ces 12 premiers passages.

Ces 12 passages deviennent le **jeu d'ancrage** initial.

## Les quatre verdicts humains

### `useful`

Le diagnostic mérite d'être conservé. La suggestion ou la question aide réellement le travail éditorial sans dégrader le passage.

### `false_positive`

Lunette Ronde voit un problème là où vous n'en voyez pas, ou attaque une difficulté qui est volontaire et fonctionnelle.

### `too_timid`

Elle a repéré quelque chose de réel, mais le diagnostic reste superficiel, mal situé ou insuffisant pour atteindre la cause du problème.

### `dangerous`

La suggestion risquerait d'abîmer un invariant important : sens, fait, degré de certitude, citation, précision technique, voix, POV, canon, ambiguïté volontaire, rythme ou intention d'auteur.

Un seul finding `dangerous` mérite une inspection immédiate. La sécurité éditoriale est plus importante qu'un taux élevé de suggestions utiles.

## Les cinq indicateurs à suivre

Ne cherchez pas un score global unique.

Suivez seulement :

- **acceptation** : proportion de findings `useful` ;
- **faux positifs** : proportion de findings `false_positive` ;
- **danger** : proportion de findings `dangerous` ;
- **questions pertinentes** : proportion de `open_question` jugées `useful` ;
- **rappel approximatif** : parmi quelques problèmes marqués à l'avance, proportion de ceux que Lunette Ronde a réellement repérés.

Les seuils ci-dessous sont des **repères de travail**, pas des standards scientifiques :

| Indicateur | Repère souhaitable | Interprétation |
|---|---:|---|
| Acceptation | 75 % ou plus | La majorité des findings servent réellement |
| Faux positifs | 20 % ou moins | Le lecteur n'invente pas trop de défauts |
| Danger | aussi proche de 0 % que possible | Priorité absolue |
| `open_question` utiles | 80 % ou plus | L'incertitude est correctement rendue à l'auteur |
| Rappel approximatif | 70 % ou plus au début | Évite une précision artificielle obtenue en ne disant presque rien |

Ne modifiez pas Lunette Ronde uniquement pour franchir un seuil. Les annotations qualitatives restent plus importantes que le chiffre.

## Progression recommandée

### Niveau 0 — jeu d'ancrage : 12 passages

Objectif : apprendre à annoter et obtenir un premier portrait du comportement.

Composition recommandée :

- 4 passages forts à protéger ;
- 4 passages faibles avec un problème réel connu ;
- 4 passages ambigus ou difficiles.

Règle : ne rien optimiser pendant ce premier passage. Corriger uniquement un défaut clairement `dangerous`.

Sortie attendue : 12 passages que vous conserverez inchangés pour toutes les versions suivantes.

### Niveau 1 — baseline : 30 passages

Objectif : avoir assez de variété pour voir des tendances.

Étendre le corpus à environ 30 passages provenant d'au moins 5 textes différents. Si vous testez les deux produits, viser approximativement la moitié AutoEssay et la moitié AutoFiction.

À la fin, relever :

- les types de findings les plus fréquents ;
- les faux positifs qui se ressemblent ;
- les cas `dangerous` ;
- les problèmes humains attendus que Lunette Ronde manque ;
- les cas où `keep` protège correctement une singularité.

Ne changez pas encore le système pour un cas isolé non dangereux.

### Niveau 2 — première calibration

Objectif : corriger une dérive récurrente sans casser ce qui fonctionne déjà.

Une modification devient raisonnable quand :

- un même faux positif apparaît dans au moins 3 passages provenant d'au moins 2 textes différents ; ou
- un même problème attendu est régulièrement manqué ; ou
- un seul cas `dangerous` révèle une faiblesse claire d'invariant.

Modifier **une seule chose** : une instruction, une définition de catégorie ou une protection d'invariant.

Attribuer un nouveau label simple à la version, par exemple :

- `baseline-01` ;
- `calibration-01-protect-ellipse` ;
- `calibration-02-genericity-observable`.

Si vous connaissez le commit Git de `writing-engine`, vous pouvez également le noter dans la colonne `lr_version`, mais ce n'est pas obligatoire pour commencer.

### Niveau 3 — régression sur les 12 ancrages

Objectif : vérifier qu'une amélioration locale ne produit pas une régression ailleurs.

Après chaque modification :

1. relancer exactement les 12 passages d'ancrage ;
2. utiliser le même mode ;
3. si possible, utiliser le même modèle ;
4. comparer aux annotations précédentes ;
5. vérifier en priorité les anciens `useful`, `keep` et les protections de voix.

Une calibration n'est pas une amélioration si elle supprime un faux positif mais crée une nouvelle intervention `dangerous`.

### Niveau 4 — corpus de 60 passages

Objectif : tester la stabilité sur de vrais textes longs et plusieurs registres.

À ce niveau, chercher moins les erreurs individuelles que les comportements récurrents :

- sur-explication récurrente ;
- transitions formulaires ;
- abstractions sans référent ;
- prudence épistémique mal comprise ;
- dialogues ou ellipses trop facilement « corrigés » ;
- problèmes de rythme réellement récurrents ;
- `open_question` répétées autour d'un même type d'ambiguïté.

C'est seulement ici qu'un besoin de véritable `LunetteRondeAudit` peut commencer à être démontré.

### Niveau 5 — preuve croisée AutoEssay / AutoFiction

Objectif : savoir ce qui appartient réellement au noyau partagé.

Pour chaque comportement que vous voudriez faire remonter dans `writing-engine`, demander :

1. existe-t-il dans AutoEssay ?
2. existe-t-il aussi dans AutoFiction ?
3. la sémantique est-elle réellement la même ?
4. les protections métier peuvent-elles rester dans les produits ?

Si la réponse n'est pas clairement oui aux trois premières questions, la capacité reste dans le produit concerné.

## Quand automatiser

N'ajoutez pas de script parce qu'un calcul manuel est possible mais ennuyeux une fois.

L'automatisation devient raisonnable quand au moins une de ces conditions est vraie :

- plus de 60 passages sont rejoués régulièrement ;
- compter manuellement les verdicts devient une source d'erreurs ;
- plusieurs personnes annotent le même corpus ;
- il faut comparer régulièrement plusieurs versions ou modèles ;
- le même regroupement longitudinal est refait plusieurs fois.

À ce moment-là, le premier outil devrait être un petit script qui lit le CSV et imprime quelques comptes. Pas de dashboard, base de données ou plateforme d'eval sans besoin supplémentaire prouvé.

## Quand envisager `LunetteRondeAudit`

Ne créer un audit corpus que lorsque les annotations montrent de vrais phénomènes qui ne peuvent pas être traités localement, par exemple :

- une même structure rhétorique répétée dans 8 chapitres ;
- une dérive de prudence épistémique au fil d'un essai ;
- un lissage progressif d'une voix sur plusieurs scènes ;
- une sur-explication répétée après des images déjà suffisantes.

Et avant extraction dans Writing Engine, la même sémantique doit être utile à au moins deux consommateurs réels.

## Discipline de calibration

Toujours conserver ces règles :

1. **texte fixe** : ne pas modifier les passages d'ancrage pendant une comparaison ;
2. **une variable à la fois** : ne pas changer simultanément prompt, mode, modèle et catégories ;
3. **même contexte** : comparer des runs effectués avec le même type de contexte produit ;
4. **séparer évaluation et réécriture** : ne pas réécrire le passage pendant que vous évaluez la qualité du diagnostic ;
5. **priorité au danger** : une suggestion qui abîme un invariant pèse plus qu'une suggestion simplement inutile ;
6. **ne pas optimiser le score** : le but est un lecteur fiable, pas une moyenne flatteuse ;
7. **conserver les cas difficiles** : ce sont eux qui révèlent les régressions les plus importantes.

## Routine minimale après chaque session

À la fin de 5 à 10 passages :

- compter rapidement les quatre verdicts ;
- noter les 1 à 3 motifs qui reviennent ;
- signaler tout cas `dangerous` ;
- ne modifier Lunette Ronde que si un motif est réellement récurrent ou dangereux ;
- conserver les meilleurs exemples de `keep` et `open_question` comme cas de régression futurs.

## Ce que vous n'avez pas besoin de savoir faire

Pour commencer, vous n'avez pas besoin de :

- coder ;
- écrire des tests automatisés ;
- utiliser Python ;
- configurer une base de données ;
- calculer des métriques statistiques avancées ;
- entraîner un modèle ;
- créer un dashboard.

Le travail le plus précieux est le jugement éditorial humain : décider si le diagnostic aide, dérange inutilement, reste superficiel ou met le texte en danger.

## Suite

Commencer par `CORPUS.md`, puis suivre `PROTOCOL.md`. Le fichier `annotation-template.csv` sert de support unique de collecte jusqu'à ce que son utilisation répétée démontre qu'un outil supplémentaire est nécessaire.
