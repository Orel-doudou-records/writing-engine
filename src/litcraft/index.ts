import { z } from "zod";
import {
  ContextBlockSchema,
  DiffractiveReferenceSchema,
  type ContextBlock,
} from "../diffract/index.js";

export const StyleSignalSchema = z.object({
  kind: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export type StyleSignal = z.infer<typeof StyleSignalSchema>;

export const StyleSituationSchema = z.object({
  signals: z.array(StyleSignalSchema).min(1),
});

export type StyleSituation = z.infer<typeof StyleSituationSchema>;

export const StylisticOperationFamilySchema = z.enum([
  "enunciation_structure",
  "syntax_rhythm_musicality",
  "tone_lexicon",
  "figuration_genre",
  "creative_imperfection",
]);

export type StylisticOperationFamily = z.infer<
  typeof StylisticOperationFamilySchema
>;

export const StyleIntensitySchema = z.enum([
  "subtle",
  "moderate",
  "structuring",
]);

export type StyleIntensity = z.infer<typeof StyleIntensitySchema>;

export const ObservedStylisticOperationSchema = z.object({
  family: StylisticOperationFamilySchema,
  category: z.string().trim().min(1),
  trigger: z.string().trim().min(3),
  operation: z.string().trim().min(3),
  target: z.string().trim().min(1),
  observedEffect: z.string().trim().min(3),
  intensity: StyleIntensitySchema.default("moderate"),
});

export type ObservedStylisticOperation = z.infer<
  typeof ObservedStylisticOperationSchema
>;

export const StyleEffectSchema = z.object({
  kind: z.string().trim().min(1),
  statement: z.string().trim().min(1),
});

export type StyleEffect = z.infer<typeof StyleEffectSchema>;

export const TextLocationSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().positive().optional(),
  })
  .superRefine((location, context) => {
    const hasStart = location.start !== undefined;
    const hasEnd = location.end !== undefined;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text offsets require both start and end",
      });
    }

    if (
      location.start !== undefined &&
      location.end !== undefined &&
      location.end <= location.start
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text location end must be greater than start",
      });
    }

    if (location.label === undefined && !hasStart && !hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text location requires a label or offsets",
      });
    }
  });

export type TextLocation = z.infer<typeof TextLocationSchema>;

export const TextEvidenceSchema = z
  .object({
    excerpt: z.string().min(1).optional(),
    location: TextLocationSchema.optional(),
  })
  .superRefine((evidence, context) => {
    if (evidence.excerpt === undefined && evidence.location === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text evidence requires an excerpt or location",
      });
    }
  });

export type TextEvidence = z.infer<typeof TextEvidenceSchema>;

export const StyleObservationProvenanceSchema = z.object({
  origin: z.enum([
    "author_text_analysis",
    "author_declaration",
    "editorial_annotation",
    "co_constructed",
  ]),
  notes: z.array(z.string().trim().min(1)).default([]),
});

export type StyleObservationProvenance = z.infer<
  typeof StyleObservationProvenanceSchema
>;

export const StyleObservationSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().trim().min(1),
  sourceTextId: z.string().trim().min(1),
  situation: StyleSituationSchema,
  operations: z.array(ObservedStylisticOperationSchema).min(1),
  effects: z.array(StyleEffectSchema).min(1),
  evidence: TextEvidenceSchema,
  provenance: StyleObservationProvenanceSchema,
  confidence: z.enum(["low", "medium", "high"]),
  maturity: z
    .enum(["single_observation", "recurring_pattern", "validated_practice"])
    .default("single_observation"),
  createdAt: z.string().datetime(),
});

export type StyleObservation = z.infer<typeof StyleObservationSchema>;
export type StyleObservationInput = z.input<typeof StyleObservationSchema>;

export function createStyleObservation(
  input: Omit<StyleObservationInput, "id" | "createdAt">
): StyleObservation {
  return StyleObservationSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  });
}

export const AuthorStyleDeclarationSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().trim().min(1),
  statement: z.string().trim().min(1),
  scope: z.enum(["global", "genre", "project", "unit"]).default("global"),
  status: z.enum(["proposed", "validated", "rejected"]).default("proposed"),
  provenance: z.string().trim().min(1),
});

export type AuthorStyleDeclaration = z.infer<
  typeof AuthorStyleDeclarationSchema
>;

export const ObservedPracticeSummarySchema = z.object({
  family: StylisticOperationFamilySchema,
  category: z.string().trim().min(1),
  observationIds: z.array(z.string().min(1)).min(1),
  operations: z.array(z.string().min(1)).min(1),
  triggers: z.array(z.string().min(1)).min(1),
  observedEffects: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ObservedPracticeSummary = z.infer<
  typeof ObservedPracticeSummarySchema
>;

export const AuthorStyleConstellationSchema = z.object({
  authorId: z.string().trim().min(1),
  observationIds: z.array(z.string().min(1)).default([]),
  observedPractices: z.array(ObservedPracticeSummarySchema).default([]),
  declaredPreferences: z.array(AuthorStyleDeclarationSchema).default([]),
  validatedSignatures: z.array(z.string().min(1)).default([]),
  productiveTensions: z.array(z.string().min(1)).default([]),
  unwantedDrifts: z.array(z.string().min(1)).default([]),
  ethicalBoundary: z.object({
    preserveMechanismsNotSurface: z.literal(true),
    forbiddenVerbatimReuse: z.literal(true),
    notes: z.array(z.string().min(1)).default([]),
  }),
  derivedAt: z.string().datetime(),
});

export type AuthorStyleConstellation = z.infer<
  typeof AuthorStyleConstellationSchema
>;

export interface DeriveAuthorStyleConstellationInput {
  authorId: string;
  observations: StyleObservation[];
  declarations?: AuthorStyleDeclaration[];
  validatedSignatures?: string[];
  productiveTensions?: string[];
  unwantedDrifts?: string[];
  ethicalNotes?: string[];
}

export function deriveAuthorStyleConstellation(
  input: DeriveAuthorStyleConstellationInput
): AuthorStyleConstellation {
  const observations = input.observations.filter(
    (observation) => observation.authorId === input.authorId
  );
  const declarations = (input.declarations ?? []).filter(
    (declaration) => declaration.authorId === input.authorId
  );
  const grouped = new Map<
    string,
    {
      family: StylisticOperationFamily;
      category: string;
      observationIds: Set<string>;
      operations: Set<string>;
      triggers: Set<string>;
      observedEffects: Set<string>;
      confidence: Set<StyleObservation["confidence"]>;
    }
  >();

  for (const observation of observations) {
    for (const operation of observation.operations) {
      const key = `${operation.family}:${operation.category}`;
      const current = grouped.get(key) ?? {
        family: operation.family,
        category: operation.category,
        observationIds: new Set<string>(),
        operations: new Set<string>(),
        triggers: new Set<string>(),
        observedEffects: new Set<string>(),
        confidence: new Set<StyleObservation["confidence"]>(),
      };

      current.observationIds.add(observation.id);
      current.operations.add(operation.operation);
      current.triggers.add(operation.trigger);
      current.observedEffects.add(operation.observedEffect);
      for (const effect of observation.effects) {
        current.observedEffects.add(effect.statement);
      }
      current.confidence.add(observation.confidence);
      grouped.set(key, current);
    }
  }

  const observedPractices = [...grouped.values()].map((practice) =>
    ObservedPracticeSummarySchema.parse({
      family: practice.family,
      category: practice.category,
      observationIds: [...practice.observationIds],
      operations: [...practice.operations],
      triggers: [...practice.triggers],
      observedEffects: [...practice.observedEffects],
      confidence: practice.confidence.has("low")
        ? "low"
        : practice.confidence.has("medium")
          ? "medium"
          : "high",
    })
  );

  return AuthorStyleConstellationSchema.parse({
    authorId: input.authorId,
    observationIds: observations.map((observation) => observation.id),
    observedPractices,
    declaredPreferences: declarations,
    validatedSignatures: [...new Set(input.validatedSignatures ?? [])],
    productiveTensions: [...new Set(input.productiveTensions ?? [])],
    unwantedDrifts: [...new Set(input.unwantedDrifts ?? [])],
    ethicalBoundary: {
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: [...new Set(input.ethicalNotes ?? [])],
    },
    derivedAt: new Date().toISOString(),
  });
}

export const TransformationTraceSchema = z.object({
  id: z.string().min(1),
  unitRef: DiffractiveReferenceSchema,
  unitVersion: z.number().int().positive(),
  operationRef: DiffractiveReferenceSchema,
  provenanceRefs: z.array(DiffractiveReferenceSchema).default([]),
  declaration: z.string().trim().min(1),
  evidence: TextEvidenceSchema,
  status: z.literal("declared"),
  createdAt: z.string().datetime(),
});

export type TransformationTrace = z.infer<typeof TransformationTraceSchema>;

export function createTransformationTrace(
  input: Omit<
    z.input<typeof TransformationTraceSchema>,
    "id" | "status" | "createdAt"
  >
): TransformationTrace {
  return TransformationTraceSchema.parse({
    id: crypto.randomUUID(),
    status: "declared",
    createdAt: new Date().toISOString(),
    ...input,
  });
}

export const StyleEffectStatusSchema = z.enum([
  "absent",
  "present_ineffective",
  "partially_effective",
  "effective",
  "harmful",
]);

export type StyleEffectStatus = z.infer<typeof StyleEffectStatusSchema>;

export const EvaluatedStyleEffectSchema = z
  .object({
    id: z.string().min(1),
    scopeRef: DiffractiveReferenceSchema,
    operationRef: DiffractiveReferenceSchema.optional(),
    traceRefs: z.array(DiffractiveReferenceSchema).default([]),
    status: StyleEffectStatusSchema,
    intendedEffects: z.array(StyleEffectSchema).default([]),
    observedEffects: z.array(StyleEffectSchema).default([]),
    unintendedEffects: z.array(StyleEffectSchema).default([]),
    evidence: z.array(TextEvidenceSchema).default([]),
    repairSuggestion: z.string().trim().min(1).optional(),
    evaluatedAt: z.string().datetime(),
    evaluator: z.string().trim().min(1),
  })
  .superRefine((effect, context) => {
    if (effect.status !== "absent" && effect.evidence.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence"],
        message: "a non-absent style effect requires textual evidence",
      });
    }

    if (effect.status !== "effective" && effect.repairSuggestion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repairSuggestion"],
        message: "a non-effective style effect requires a repair suggestion",
      });
    }
  });

export type EvaluatedStyleEffect = z.infer<typeof EvaluatedStyleEffectSchema>;

export function createEvaluatedStyleEffect(
  input: Omit<z.input<typeof EvaluatedStyleEffectSchema>, "id" | "evaluatedAt">
): EvaluatedStyleEffect {
  return EvaluatedStyleEffectSchema.parse({
    id: crypto.randomUUID(),
    evaluatedAt: new Date().toISOString(),
    ...input,
  });
}

export function evaluatedStyleEffectToContextBlock(
  effect: EvaluatedStyleEffect
): ContextBlock {
  const render = (items: StyleEffect[]) =>
    items.length > 0
      ? items.map((item) => `${item.kind}: ${item.statement}`).join(" | ")
      : "none";

  return ContextBlockSchema.parse({
    ref: { kind: "style-effect", id: effect.id },
    label: "Evaluated style effect",
    text: [
      `status: ${effect.status}`,
      `intended: ${render(effect.intendedEffects)}`,
      `observed: ${render(effect.observedEffects)}`,
      `unintended: ${render(effect.unintendedEffects)}`,
    ].join("\n"),
  });
}
