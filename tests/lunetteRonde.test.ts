import { describe, expect, it } from "vitest";
import {
  LunetteRondeFindingSchema,
  LunetteRondeReviewSchema,
  buildLunetteRondeInstructions,
} from "../src/index.js";

describe("Lunette Ronde shared contract", () => {
  it("keeps interventions situated and prefers explicit author questions over invention", () => {
    expect(
      LunetteRondeReviewSchema.parse({
        mode: "full",
        findings: [
          {
            kind: "clarify",
            evidence: { excerpt: "Cette optimisation significative change tout." },
            diagnosis: "L'effet est affirmé sans objet concret.",
            suggestion: "Nommer ce qui a changé et son effet observable.",
          },
          {
            kind: "open_question",
            evidence: { excerpt: "Cette décision était inévitable." },
            diagnosis: "Le texte affirme une nécessité sans donner sa cause.",
            authorQuestion: "Qu'est-ce qui rend cette décision inévitable ici ?",
          },
          {
            kind: "keep",
            evidence: { excerpt: "La porte resta ouverte." },
            diagnosis: "La phrase est nette et son rythme sert le passage.",
          },
        ],
      }).findings
    ).toHaveLength(3);

    expect(() =>
      LunetteRondeFindingSchema.parse({
        kind: "open_question",
        evidence: { excerpt: "Tout devait changer." },
        diagnosis: "Le référent de tout est indéterminé.",
      })
    ).toThrow(/author question/);

    expect(() =>
      LunetteRondeFindingSchema.parse({
        kind: "keep",
        evidence: { excerpt: "La porte resta ouverte." },
        diagnosis: "Le passage tient.",
        suggestion: "Raccourcir.",
      })
    ).toThrow(/cannot prescribe/);

    const instructions = buildLunetteRondeInstructions("full");
    expect(instructions).toContain("vient après la compréhension");
    expect(instructions).toContain("degré de certitude");
    expect(instructions).toContain("open_question");
    expect(instructions).toContain("origine humaine ou IA");
  });
});
