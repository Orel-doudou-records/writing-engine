import { describe, expect, it } from "vitest";
import {
  StyleObservationSchema,
  StyleSituationSchema,
  TextEvidenceSchema,
  createStyleObservation,
} from "../src/index.js";

function validObservation() {
  return createStyleObservation({
    authorId: "author-1",
    sourceTextId: "text-1",
    situation: {
      signals: [
        { kind: "scene_function", value: "rupture" },
        { kind: "reader_state", value: "reliability becomes uncertain" },
      ],
    },
    operations: [
      {
        family: "syntax_rhythm_musicality",
        category: "custom_fragmentation",
        trigger: "the narrator loses certainty",
        operation: "shorten clauses and interrupt causal transitions",
        target: "scene_voice",
        observedEffect: "the reader experiences the rupture rather than receiving an explanation",
        intensity: "structuring",
      },
    ],
    effects: [
      {
        kind: "reader",
        statement: "the narrator's reliability becomes perceptibly unstable",
      },
    ],
    evidence: {
      excerpt: "The road ended. Or perhaps it had never begun.",
      location: { label: "scene 7" },
    },
    provenance: {
      origin: "author_text_analysis",
      notes: ["single passage only"],
    },
    confidence: "high",
  });
}

describe("minimal Litcraft style observation", () => {
  it("creates a grounded observation and defaults maturity to single_observation", () => {
    const observation = validObservation();

    expect(observation.id).toBeTruthy();
    expect(observation.createdAt).toBeTruthy();
    expect(observation.maturity).toBe("single_observation");
    expect(observation.situation.signals).toHaveLength(2);
    expect(observation.operations[0]?.category).toBe("custom_fragmentation");
    expect(observation.operations[0]?.target).toBe("scene_voice");
  });

  it("requires at least one situated signal", () => {
    expect(() => StyleSituationSchema.parse({ signals: [] })).toThrow();
  });

  it("requires evidence as an excerpt or location", () => {
    expect(() => TextEvidenceSchema.parse({})).toThrow();
  });

  it("rejects incomplete or inverted offsets", () => {
    expect(() =>
      TextEvidenceSchema.parse({ location: { start: 10 } })
    ).toThrow();
    expect(() =>
      TextEvidenceSchema.parse({ location: { start: 20, end: 10 } })
    ).toThrow();
  });

  it("rejects an adjective presented as a complete stylistic operation", () => {
    const observation = validObservation();
    const candidate = {
      ...observation,
      operations: [
        {
          family: "tone_lexicon",
          category: "language_register",
          operation: "lyrical",
          target: "paragraph",
        },
      ],
    };

    expect(() => StyleObservationSchema.parse(candidate)).toThrow();
  });

  it("allows consumers to use their own non-empty category and target vocabulary", () => {
    const observation = validObservation();

    expect(observation.operations[0]).toEqual(
      expect.objectContaining({
        category: "custom_fragmentation",
        target: "scene_voice",
      })
    );
  });
});
