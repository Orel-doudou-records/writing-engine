import { describe, expect, it } from "vitest";
import {
  EvaluatedStyleEffectSchema,
  createDiffractiveCore,
  createEvaluatedStyleEffect,
  createTransformationTrace,
  evaluatedStyleEffectToContextBlock,
} from "../src/index.js";

describe("Litcraft style-effect feedback", () => {
  it("records a transformation attempt without treating it as proof", () => {
    const trace = createTransformationTrace({
      unitRef: { kind: "scene", id: "scene-7" },
      unitVersion: 2,
      operationRef: { kind: "style-operation", id: "operation-3" },
      provenanceRefs: [{ kind: "decision", id: "decision-2" }],
      declaration: "Shortened clauses around the rupture.",
      evidence: {
        excerpt: "The road ended. Then the voice broke.",
        location: { label: "scene 7" },
      },
    });

    expect(trace.status).toBe("declared");
    expect(trace.id).toBeTruthy();
    expect(trace.createdAt).toBeTruthy();
    expect(trace).not.toHaveProperty("effective");
    expect(trace).not.toHaveProperty("score");
  });

  it("requires evidence for every non-absent evaluated effect", () => {
    expect(() =>
      EvaluatedStyleEffectSchema.parse({
        id: "effect-1",
        scopeRef: { kind: "scene", id: "scene-7" },
        status: "effective",
        intendedEffects: [],
        observedEffects: [{ kind: "reader", statement: "distance decreases" }],
        unintendedEffects: [],
        evidence: [],
        evaluatedAt: new Date().toISOString(),
        evaluator: "style-judge",
      })
    ).toThrow();
  });

  it("requires a repair suggestion whenever the effect is not effective", () => {
    expect(() =>
      EvaluatedStyleEffectSchema.parse({
        id: "effect-1",
        scopeRef: { kind: "scene", id: "scene-7" },
        status: "harmful",
        intendedEffects: [],
        observedEffects: [{ kind: "reader", statement: "distance collapses" }],
        unintendedEffects: [],
        evidence: [{ excerpt: "The voice became the character." }],
        evaluatedAt: new Date().toISOString(),
        evaluator: "style-judge",
      })
    ).toThrow();
  });

  it("projects an evaluated effect into Diffract without raw writer logs", () => {
    const effect = createEvaluatedStyleEffect({
      scopeRef: { kind: "scene", id: "scene-7" },
      operationRef: { kind: "style-operation", id: "operation-3" },
      traceRefs: [{ kind: "transformation-trace", id: "trace-1" }],
      status: "partially_effective",
      intendedEffects: [
        { kind: "rhythmic", statement: "make the rupture formally perceptible" },
      ],
      observedEffects: [
        { kind: "reader", statement: "the narrator feels closer to the protagonist" },
      ],
      unintendedEffects: [
        { kind: "narrative", statement: "narrator independence becomes ambiguous" },
      ],
      evidence: [{ excerpt: "The road ended. Then the voice broke." }],
      repairSuggestion: "Keep fragmentation but restore narrator distance outside the scene.",
      evaluator: "style-judge",
    });

    const block = evaluatedStyleEffectToContextBlock(effect);

    expect(block.ref).toEqual({ kind: "style-effect", id: effect.id });
    expect(block.label).toBe("Evaluated style effect");
    expect(block.text).toContain("status: partially_effective");
    expect(block.text).toContain("intended: rhythmic: make the rupture formally perceptible");
    expect(block.text).toContain("observed: reader: the narrator feels closer to the protagonist");
    expect(block.text).toContain("unintended: narrative: narrator independence becomes ambiguous");
    expect(block.text).not.toContain("Shortened clauses around the rupture");
  });

  it("lets the existing Diffract core consume the style-effect context block", async () => {
    const effect = createEvaluatedStyleEffect({
      scopeRef: { kind: "scene", id: "scene-7" },
      status: "effective",
      intendedEffects: [{ kind: "rhythmic", statement: "formalize the rupture" }],
      observedEffects: [{ kind: "reader", statement: "the rupture becomes embodied" }],
      unintendedEffects: [],
      evidence: [{ excerpt: "The road ended. Then the voice broke." }],
      evaluator: "style-judge",
    });
    const block = evaluatedStyleEffectToContextBlock(effect);
    const core = createDiffractiveCore({
      async generateJson(prompt) {
        expect(prompt).toContain(`[style-effect:${effect.id}] Evaluated style effect`);
        expect(prompt).toContain("status: effective");
        return {
          pass1: { refraction: ["The observed effect makes a persistent change thinkable."] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: { entanglements: [] },
          pass4: {
            cut: "Keep the observed effect as decision material only.",
            included: ["observed style effect"],
            excluded: ["automatic state mutation"],
            cutOfNonAdoption: [],
          },
          verdict: "incubate",
          verdictDetail: "Product governance must decide persistence.",
          action: "Review the effect in product context.",
          tradeoffs: [],
          impacts: [],
        };
      },
    });

    const reading = await core.read({
      fragment: { statement: "Should this style change persist?" },
      context: [block],
    });

    expect(reading.verdict).toBe("incubate");
  });
});
