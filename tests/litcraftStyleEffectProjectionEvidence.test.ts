import { describe, expect, it } from "vitest";
import {
  createDiffractiveCore,
  createEvaluatedStyleEffect,
  evaluatedStyleEffectToContextBlock,
} from "../src/index.js";

describe("Litcraft evaluated-effect evidence projection", () => {
  it("carries validated textual evidence into the existing Diffract context block and prompt", async () => {
    const effect = createEvaluatedStyleEffect({
      scopeRef: { kind: "scene-version", id: "scene-12@3" },
      operationRef: { kind: "style-operation", id: "operation-rhythm-break" },
      traceRefs: [{ kind: "transformation-trace", id: "trace-rhythm" }],
      status: "effective",
      intendedEffects: [
        { kind: "rhythmic", statement: "Acceleration becomes perceptible." },
      ],
      observedEffects: [
        { kind: "rhythmic", statement: "The clipped sequence accelerates the scene." },
      ],
      unintendedEffects: [
        { kind: "reader", statement: "Narrator control feels less stable." },
      ],
      evidence: [
        {
          excerpt: "Door. Table. Breath.",
          location: { start: 0, end: 20 },
        },
      ],
      evaluator: "fixture-evaluator",
    });

    const block = evaluatedStyleEffectToContextBlock(effect);

    expect(block.text).toContain("evidence:");
    expect(block.text).toContain("Door. Table. Breath.");

    const core = createDiffractiveCore({
      async generateJson(prompt) {
        expect(prompt).toContain("Door. Table. Breath.");
        return {
          pass1: { refraction: [] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: { entanglements: [] },
          pass4: {
            cut: "Keep evidence inspectable while preserving author governance.",
            included: ["evaluated evidence"],
            excluded: ["raw writer logs"],
            cutOfNonAdoption: [],
          },
          verdict: "incubate",
          verdictDetail: "Evidence is available to product reasoning.",
          action: "Return to product governance.",
          tradeoffs: [],
          impacts: [],
        };
      },
    });

    await core.read({
      fragment: {
        statement: "What does this evaluated style effect imply?",
        refs: [{ kind: "style-effect", id: effect.id }],
      },
      context: [block],
    });
  });
});
