import { z } from "zod";
import { TextEvidenceSchema } from "../litcraft/index.js";

export const LunetteRondeModeSchema = z.enum(["lite", "full", "ultra"]);
export type LunetteRondeMode = z.infer<typeof LunetteRondeModeSchema>;

export const LunetteRondeFindingKindSchema = z.enum([
  "cut",
  "clarify",
  "concretize",
  "rhythm",
  "genericity",
  "syntax",
  "keep",
  "open_question",
]);
export type LunetteRondeFindingKind = z.infer<
  typeof LunetteRondeFindingKindSchema
>;

export const LunetteRondeFindingSchema = z
  .object({
    kind: LunetteRondeFindingKindSchema,
    evidence: TextEvidenceSchema,
    diagnosis: z.string().trim().min(1),
    suggestion: z.string().trim().min(1).optional(),
    authorQuestion: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((finding, context) => {
    if (finding.kind === "open_question" && finding.authorQuestion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authorQuestion"],
        message: "an open question requires a precise author question",
      });
    }

    if (finding.kind === "keep") {
      if (finding.suggestion !== undefined || finding.authorQuestion !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "a keep finding cannot prescribe an intervention",
        });
      }
      return;
    }

    if (finding.kind !== "open_question" && finding.suggestion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestion"],
        message: "an intervention finding requires a situated suggestion",
      });
    }
  });

export type LunetteRondeFinding = z.infer<typeof LunetteRondeFindingSchema>;

export const LunetteRondeReviewSchema = z
  .object({
    mode: LunetteRondeModeSchema,
    findings: z.array(LunetteRondeFindingSchema).default([]),
  })
  .strict();

export type LunetteRondeReview = z.infer<typeof LunetteRondeReviewSchema>;

const MODE_GUIDANCE: Record<LunetteRondeMode, string> = {
  lite: "Corrige seulement les lourdeurs évidentes et préserve presque toute la structure.",
  full: "Clarifie, coupe et réordonne avec mesure sans effacer la voix.",
  ultra:
    "Interviens franchement quand le texte ne tient pas et transforme le flou irréductible en question explicite.",
};

export function buildLunetteRondeInstructions(
  mode: LunetteRondeMode = "full"
): string {
  const resolvedMode = LunetteRondeModeSchema.parse(mode);

  return [
    "Tu es Lunette Ronde, un lecteur éditorial discret qui n'est pas dupe.",
    "Lis le passage entier avant de corriger une phrase : l'intervention minimale vient après la compréhension.",
    "Cherche la cause, pas le symptôme : idée mal ordonnée, concept non défini, relation logique absente, abstraction sans référent, répétition ou sur-explication.",
    "Préserve le sens, les faits fournis, le degré de certitude, les citations, les contraintes explicites et la voix de l'auteur.",
    "Une phrase plus courte mais moins exacte est une mauvaise correction.",
    "Ne raccourcis pas par principe : protège le rythme, l'ellipse, l'ambiguïté productive, la précision technique et les difficultés qui produisent un effet réel.",
    "Si une correction honnête exige une information absente ou une décision d'auteur, retourne open_question avec une question précise au lieu d'inventer.",
    "keep est un résultat valide quand le passage tient déjà.",
    "Décris uniquement des phénomènes observables du texte ; ne déduis jamais son origine humaine ou IA.",
    `Mode ${resolvedMode}: ${MODE_GUIDANCE[resolvedMode]}`,
  ].join("\n");
}
