import { describe, expect, it } from "vitest";
import {
  AuthorStyleDeclarationSchema,
  createStyleObservation,
  deriveAuthorStyleConstellation,
} from "../src/index.js";

function observation(
  authorId: string,
  confidence: "low" | "medium" | "high",
  effectStatement: string
) {
  return createStyleObservation({
    authorId,
    sourceTextId: `text-${authorId}-${confidence}`,
    situation: {
      signals: [{ kind: "scene_function", value: "maintain uncertainty" }],
    },
    operations: [
      {
        family: "enunciation_structure",
        category: "voice_attribution",
        trigger: "two incompatible accounts remain active",
        operation: "attribute each account before any synthesis",
        target: "narrator_voice",
        observedEffect: "the accounts remain distinguishable",
      },
    ],
    effects: [{ kind: "reader", statement: effectStatement }],
    evidence: { excerpt: "Each account keeps its own pressure." },
    provenance: { origin: "author_text_analysis" },
    confidence,
  });
}

describe("deriveAuthorStyleConstellation", () => {
  it("groups grounded practices for one author and keeps the weakest confidence", () => {
    const first = observation("author-1", "high", "uncertainty stays visible");
    const second = observation("author-1", "medium", "the reader compares accounts");
    const foreign = observation("author-2", "low", "foreign effect");
    const declaration = AuthorStyleDeclarationSchema.parse({
      id: "declaration-1",
      authorId: "author-1",
      statement: "Do not explain away a productive contradiction.",
      status: "validated",
      provenance: "author charter",
    });

    const constellation = deriveAuthorStyleConstellation({
      authorId: "author-1",
      observations: [first, second, foreign],
      declarations: [declaration],
      validatedSignatures: ["material perception before explanation", "material perception before explanation"],
      productiveTensions: ["distance and proximity"],
      unwantedDrifts: ["decorative ambiguity"],
      ethicalNotes: ["Never reuse singular wording verbatim."],
    });

    expect(constellation.observationIds).toEqual([first.id, second.id]);
    expect(constellation.observedPractices).toHaveLength(1);
    expect(constellation.observedPractices[0]).toEqual(
      expect.objectContaining({
        family: "enunciation_structure",
        category: "voice_attribution",
        confidence: "medium",
        observationIds: expect.arrayContaining([first.id, second.id]),
        operations: ["attribute each account before any synthesis"],
        triggers: ["two incompatible accounts remain active"],
        observedEffects: expect.arrayContaining([
          "the accounts remain distinguishable",
          "uncertainty stays visible",
          "the reader compares accounts",
        ]),
      })
    );
    expect(constellation.declaredPreferences).toEqual([declaration]);
    expect(constellation.validatedSignatures).toEqual([
      "material perception before explanation",
    ]);
    expect(constellation.productiveTensions).toEqual(["distance and proximity"]);
    expect(constellation.unwantedDrifts).toEqual(["decorative ambiguity"]);
    expect(constellation.ethicalBoundary).toEqual({
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: ["Never reuse singular wording verbatim."],
    });
  });

  it("does not infer signatures, preferences, tensions or drifts from observations", () => {
    const constellation = deriveAuthorStyleConstellation({
      authorId: "author-1",
      observations: [observation("author-1", "high", "effect")],
    });

    expect(constellation.validatedSignatures).toEqual([]);
    expect(constellation.declaredPreferences).toEqual([]);
    expect(constellation.productiveTensions).toEqual([]);
    expect(constellation.unwantedDrifts).toEqual([]);
    expect(constellation).not.toHaveProperty("generationDirectives");
    expect(constellation).not.toHaveProperty("editorialDecisionIds");
  });

  it("filters declarations belonging to another author", () => {
    const constellation = deriveAuthorStyleConstellation({
      authorId: "author-1",
      observations: [observation("author-1", "high", "effect")],
      declarations: [
        AuthorStyleDeclarationSchema.parse({
          id: "foreign-declaration",
          authorId: "author-2",
          statement: "Foreign preference",
          provenance: "other author",
        }),
      ],
    });

    expect(constellation.declaredPreferences).toEqual([]);
  });
});
