import { describe, expect, it } from "vitest";
import {
  createDiffractiveCore,
  createDiffractiveReading,
  type StructuredJsonClient,
} from "../src/diffract/index.js";

describe("minimal Diffract core", () => {
  it("creates a domain-neutral immutable reading artifact", () => {
    const reading = createDiffractiveReading({
      fragment: {
        statement: "Make the narrative voice more fragmented after the rupture.",
        refs: [{ kind: "scene", id: "scene-7" }],
      },
      pass4: {
        cut: "Use fragmentation locally without changing the book-wide voice yet.",
        included: ["local fragmentation"],
        excluded: ["global voice transition"],
        cutOfNonAdoption: ["keeping the rupture formally invisible"],
      },
      verdict: "adapt_differently",
      verdictDetail: "Localize the formal rupture before making it persistent.",
      action: "Test the change in scene 7 and evaluate its effects.",
      impacts: [
        {
          target: { kind: "scene", id: "scene-7" },
          impact: "The scene becomes the formal rupture point.",
        },
      ],
    });

    expect(reading.pass1.refraction).toEqual([]);
    expect(reading.pass2.namedPatterns).toEqual([]);
    expect(reading.pass3.entanglements).toEqual([]);
    expect(reading.impacts[0]?.target).toEqual({ kind: "scene", id: "scene-7" });
    expect(reading.id).toBeTruthy();
    expect(reading.createdAt).toBeTruthy();
  });

  it("reads a fragment through consumer-projected context without knowing the consumer domain", async () => {
    const client: StructuredJsonClient = {
      async generateJson(prompt) {
        expect(prompt).toContain("[scene:scene-7] Rupture scene");
        expect(prompt).toContain("[style-effect:effect-2] Evaluated style effect");
        expect(prompt).toContain("existing cut");

        return {
          pass1: { refraction: ["The proposal intensifies an already visible rupture."] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: {
            entanglements: [
              {
                name: "voice × rupture",
                cutIfIntegrated: "The rupture becomes formal as well as narrative.",
                becomesIntelligible: ["why the scene feels discontinuous"],
                becomesUnintelligible: ["whether the voice remains stable afterwards"],
              },
            ],
          },
          pass4: {
            cut: "Keep the change local until post-writing evaluation.",
            included: ["local fragmentation"],
            excluded: ["persistent voice change"],
            cutOfNonAdoption: ["a formally neutral rupture"],
          },
          verdict: "adapt_differently",
          verdictDetail: "Local first, persistence only after observed effects.",
          action: "Write locally, evaluate, then re-diffract the observed effect.",
          tradeoffs: [
            {
              path: "Do nothing",
              effort: "none",
              reversibility: "complete",
              leverage: "low",
              distractionTax: "low",
              verdict: "discard",
            },
            {
              path: "Local fragmentation",
              effort: "low",
              reversibility: "high",
              leverage: "high",
              distractionTax: "low",
              verdict: "adapt_differently",
            },
          ],
          impacts: [
            {
              target: { kind: "style-effect", id: "effect-2" },
              impact: "Re-evaluate whether the local change should become persistent.",
            },
          ],
        };
      },
    };

    const core = createDiffractiveCore(client);
    const reading = await core.read({
      fragment: {
        statement: "Fragment the voice at the rupture.",
        refs: [{ kind: "scene", id: "scene-7" }],
      },
      context: [
        {
          ref: { kind: "scene", id: "scene-7" },
          label: "Rupture scene",
          text: "The protagonist discovers the village pact.",
        },
        {
          ref: { kind: "style-effect", id: "effect-2" },
          label: "Evaluated style effect",
          text: "Shorter clauses increased proximity to the protagonist.",
        },
      ],
      existingCuts: [
        {
          target: { kind: "project", id: "book-1" },
          verdict: "keep",
          cut: "Preserve narrator independence outside protagonist scenes.",
        },
      ],
    });

    expect(reading.verdict).toBe("adapt_differently");
    expect(reading.impacts).toHaveLength(1);
  });

  it("rejects duplicate context references", async () => {
    const core = createDiffractiveCore({
      async generateJson() {
        throw new Error("model should not be called");
      },
    });

    await expect(
      core.read({
        fragment: { statement: "test" },
        context: [
          { ref: { kind: "scene", id: "same" }, label: "A", text: "A" },
          { ref: { kind: "scene", id: "same" }, label: "B", text: "B" },
        ],
      })
    ).rejects.toThrow("context references must be unique");
  });

  it("rejects impacts that target references absent from the request", async () => {
    const core = createDiffractiveCore({
      async generateJson() {
        return {
          pass1: { refraction: [] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: { entanglements: [] },
          pass4: {
            cut: "Keep the proposal local.",
            included: [],
            excluded: [],
            cutOfNonAdoption: [],
          },
          verdict: "incubate",
          verdictDetail: "Need evidence from the written scene.",
          action: "Evaluate after writing.",
          tradeoffs: [],
          impacts: [
            {
              target: { kind: "arc", id: "invented-arc" },
              impact: "This identifier was not supplied by the consumer.",
            },
          ],
        };
      },
    });

    await expect(
      core.read({
        fragment: { statement: "test" },
        context: [{ ref: { kind: "scene", id: "scene-1" }, label: "Scene", text: "Text" }],
      })
    ).rejects.toThrow("unknown impact target arc:invented-arc");
  });
});
