# Protocole d'annotation Lunette Ronde

Ce protocole transforme une review Lunette Ronde en données simples à comparer dans le temps.

Il doit rester utilisable manuellement. Si une étape exige du code pour être comprise ou exécutée, elle est trop complexe pour ce stade.

## 1. Unité d'évaluation

Une unité est un passage borné fourni à Lunette Ronde.

Taille recommandée : 800 à 1 500 mots environ.

Éviter :

- une phrase isolée sans contexte ;
- un chapitre entier de dizaines de milliers de mots ;
- un passage coupé au milieu d'une phrase ;
- un extrait choisi uniquement parce qu'il contient déjà un défaut évident.

Chaque passage reçoit un identifiant stable, par exemple :

```text
essay01-p01
essay01-p02
fiction02-p03
```

L'identifiant ne change pas entre deux versions de Lunette Ronde si le texte du passage est identique.

## 2. Avant de lancer Lunette Ronde

Pour chaque passage, renseigner au minimum :

- `passage_id` ;
- `text_id` ;
- `product` ;
- `segment_profile` ;
- `mode` ;
- `lr_version` ;
- `model` si vous connaissez son nom.

### Marquer quelques problèmes attendus

Sur environ un tiers des passages, écrire avant la review un problème que vous savez présent.

Exemples :

- « la causalité n'est pas claire » ;
- « cette transition répète la conclusion précédente » ;
- « le concept central n'a pas encore de référent » ;
- « aucune correction attendue : le rythme heurté est volontaire ».

Cette étape évite d'évaluer uniquement ce que Lunette Ronde a choisi de montrer.

Renseigner :

- `expected_problem = yes` ou `no` ;
- `expected_problem_description` si nécessaire.

Ne pas écrire la correction attendue. On cherche à tester le diagnostic, pas la capacité à reproduire votre solution.

## 3. Lancer la review

Pour une baseline, utiliser `full` par défaut.

Ne changez pas de mode entre deux passages simplement parce que le résultat précédent ne vous plaît pas.

Pendant une campagne de comparaison :

- conserver le même mode ;
- conserver autant que possible le même modèle ;
- conserver le même contexte produit ;
- ne pas modifier le texte d'ancrage.

## 4. Reporter les résultats

Créer une ligne par finding.

Répéter les métadonnées du passage (`passage_id`, `text_id`, produit, mode, version) sur chaque ligne si cela facilite la lecture du tableur.

En revanche, renseigner `expected_problem`, `expected_problem_description` et `expected_problem_detected` **uniquement sur la première ligne du passage**. Laisser ces trois cellules vides sur les findings suivants. Sinon un passage avec plusieurs findings serait compté plusieurs fois dans le rappel approximatif.

Pour chaque finding, reporter :

- `finding_kind` ;
- `evidence_excerpt` ;
- `diagnosis` ;
- `proposal` : suggestion pour une intervention ou question pour `open_question`.

Si la review retourne `findings: []`, créer quand même une ligne pour le passage avec :

```text
finding_kind = none
human_verdict = not_applicable
```

Cela permet de conserver la trace du passage évalué.

## 5. Donner un verdict humain

### `useful`

Utiliser lorsque :

- le problème existe réellement ;
- le diagnostic est situé et compréhensible ;
- la suggestion ou la question est éditorialement exploitable ;
- aucun invariant important n'est sacrifié.

Un `keep` peut être `useful` si la raison de préserver le passage est juste.

Un `open_question` peut être `useful` si l'information manque réellement et que la question est celle que l'auteur doit trancher.

### `false_positive`

Utiliser lorsque :

- le problème n'existe pas ;
- la difficulté est volontaire et fonctionnelle ;
- Lunette Ronde interprète une singularité stylistique comme un défaut ;
- la suggestion répond à un problème inventé.

### `too_timid`

Utiliser lorsque :

- le signal est réel ;
- mais le diagnostic traite surtout le symptôme ;
- ou la suggestion est trop locale pour résoudre la cause ;
- ou une `open_question` aurait été plus honnête qu'une suggestion incomplète.

`too_timid` n'est pas synonyme de « je préfère une correction plus forte ». Il indique que Lunette Ronde n'a pas encore atteint le bon niveau de compréhension.

### `dangerous`

Utiliser lorsqu'une suggestion risquerait de modifier à tort :

- le sens ;
- un fait ;
- le degré de certitude ;
- une citation ;
- une distinction conceptuelle ;
- une précision technique ;
- la voix ;
- un POV ;
- le canon ;
- le ReaderModel ;
- une ellipse ou ambiguïté volontaire ;
- un effet de rythme voulu ;
- une intention d'auteur connue.

Renseigner `danger_reason` en une phrase courte.

Un cas `dangerous` doit être examiné avant toute optimisation de confort ou de fréquence des findings.

## 6. Vérifier les problèmes attendus

Après la review, revenir aux passages marqués avec un problème attendu.

Renseigner :

- `expected_problem_detected = yes` si au moins un finding identifie substantiellement le problème ;
- `expected_problem_detected = no` sinon.

Le wording n'a pas besoin d'être identique à votre annotation initiale. C'est la compréhension du problème qui compte.

Pour un passage volontairement bon où `expected_problem = no`, ne comptez pas comme échec une review vide ou un `keep` pertinent. Ces lignes ne font pas partie du dénominateur du rappel des problèmes attendus.

## 7. Calculs manuels

On peut calculer les indicateurs avec une simple calculatrice.

### Acceptation

```text
findings useful / findings annotés
```

Ne pas inclure les lignes `finding_kind = none`.

### Faux positifs

```text
false_positive / findings annotés
```

### Danger

```text
dangerous / findings annotés
```

### Questions pertinentes

```text
open_question jugées useful / tous les open_question annotés
```

### Rappel approximatif

```text
problèmes attendus détectés / problèmes attendus
```

Ce rappel reste volontairement approximatif : le corpus n'est pas annoté exhaustivement comme un dataset académique.

## 8. Lecture qualitative avant les chiffres

Avant de changer Lunette Ronde, regrouper les notes par motif.

Exemple :

```text
faux positif — ellipse volontaire : 4 passages / 3 textes
faux positif — phrase longue technique : 1 passage
miss — abstraction sans référent : 5 passages / 2 textes
danger — transforme une prudence en certitude : 1 passage
```

La première ligne indique probablement une dérive récurrente.

La deuxième n'est pas encore suffisante pour changer le noyau.

La troisième mérite une calibration ciblée.

La quatrième mérite une correction immédiate de protection, même si elle n'apparaît qu'une fois.

## 9. Règle de modification

Modifier une seule dimension à la fois.

Bon exemple :

```text
calibration-03
changement : préciser que les ellipses intentionnelles doivent produire keep
```

Mauvais exemple :

```text
calibration-03
- nouveau modèle
- prompt réécrit
- catégories modifiées
- mode ultra
- contexte doublé
```

Dans le deuxième cas, une amélioration ou régression devient impossible à attribuer.

## 10. Régression

Après chaque modification :

1. rejouer les 12 passages d'ancrage ;
2. comparer finding par finding ;
3. vérifier tous les anciens cas `dangerous` ;
4. vérifier les passages forts qui recevaient `keep` ou aucune intervention ;
5. vérifier les `open_question` importantes ;
6. seulement ensuite tester de nouveaux passages.

## 11. Décisions de progression

### Continuer à annoter sans changer Lunette Ronde

Choisir cette option lorsque les erreurs sont isolées et sans motif clair.

### Modifier une instruction

Choisir cette option lorsqu'un motif récurrent apparaît sur plusieurs textes ou lorsqu'un invariant est mis en danger.

### Ajouter une nouvelle catégorie de finding

Ne le faire que si les catégories actuelles ne peuvent réellement pas représenter le phénomène. Un nouveau mot pour un cas déjà exprimable n'ajoute pas de capacité.

### Créer un audit longitudinal

Ne le faire que si des phénomènes utiles n'apparaissent qu'en agrégeant plusieurs unités ou chapitres, et si ce besoin existe dans plusieurs produits avec la même sémantique.

### Ajouter de l'automatisation

Ne le faire que lorsque la répétition manuelle du protocole devient elle-même un problème mesurable.

## 12. Ce qu'il ne faut pas mesurer

Ne pas produire :

- score d'humanité ;
- probabilité de texte IA ;
- score global de littérature ;
- score de « voix authentique » ;
- classement absolu des auteurs ;
- quantité maximale de corrections comme objectif.

Lunette Ronde doit devenir un lecteur plus fiable, pas un système qui optimise un chiffre abstrait.
