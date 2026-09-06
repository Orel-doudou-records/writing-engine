import { z } from "zod";

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
