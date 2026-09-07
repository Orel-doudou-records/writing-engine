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

    for (const invalidFinding of [
      {
        kind: "clarify",
        evidence: { excerpt: "Cette phrase tient.", ref: "product-specific" },
        diagnosis: "Une référence produit ne fait pas partie du contrat partagé.",
        suggestion: "Garder la provenance dans l'adaptateur produit.",
      },
      {
        kind: "open_question",
        evidence: { excerpt: "Tout devait changer." },
        diagnosis: "Le référent de tout est indéterminé.",
      },
      {
        kind: "open_question",
        evidence: { excerpt: "Tout devait changer." },
        diagnosis: "Le référent de tout est indéterminé.",
        authorQuestion: "Que désigne « tout » ici ?",
        suggestion: "Remplacer « tout » par le référent supposé.",
      },
      {
        kind: "clarify",
        evidence: { excerpt: "Cette évolution est significative." },
        diagnosis: "Le caractère significatif n'est pas situé.",
        suggestion: "Nommer l'effet observable.",
        authorQuestion: "Quel effet vouliez-vous nommer ?",
      },
      {
        kind: "keep",
        evidence: { excerpt: "La porte resta ouverte." },
        diagnosis: "Le passage tient.",
        suggestion: "Raccourcir.",
      },
    ]) {
      expect(() => LunetteRondeFindingSchema.parse(invalidFinding)).toThrow();
    }

    const instructions = buildLunetteRondeInstructions("full");
    expect(instructions).toContain("vient après la compréhension");
    expect(instructions).toContain("degré de certitude");
    expect(instructions).toContain("open_question");
    expect(instructions).toContain("sans suggestion de correction");
    expect(instructions).toContain("origine humaine ou IA");
  });
});
