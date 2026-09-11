import { describe, expect, it } from "vitest";
import { runEssayConsumerFixture } from "./fixtures/cc1EssayConsumer.js";
import { runFictionConsumerFixture } from "./fixtures/cc1FictionConsumer.js";

describe("Collaborative Manuscript Core consumer boundary", () => {
  it("supports an essay authoring consumer through direct contribution without knowing Claim", () => {
    const essay = runEssayConsumerFixture();

    expect(essay.policy.rules[0]?.mode).toBe("direct");
    expect(essay.graph.branches["essay-draft"]?.headRevisionId).toBe("essay-r1");
    expect(essay.graph.branches.main?.headRevisionId).toBe("essay-r0");
    expect(essay.revision.author.id).toBe("essay-author-agent");
    expect(essay.manuscript.nodes["essay-paragraph"]?.domainRefs).toContainEqual({
      kind: "claim",
      id: "claim-42",
    });
    expect(essay.manuscript.nodes["essay-paragraph"]?.contentRef?.version).toBe(1);
  });

  it("supports a fiction editorial consumer through propose/review/integration while preserving a variant", () => {
    const fiction = runFictionConsumerFixture();

    expect(fiction.authorization).toEqual({ authorized: true, mode: "propose" });
    expect(fiction.integrated.proposal.status).toBe("integrated");
    expect(fiction.integrated.commit.graph.branches.main?.headRevisionId).toBe(
      "fiction-r-integrated"
    );
    expect(fiction.variant.graph.branches.main?.headRevisionId).toBe(
      "fiction-r-integrated"
    );
    expect(fiction.variant.graph.branches["fiction-variant"]?.headRevisionId).toBe(
      "fiction-r-variant"
    );

    expect(
      fiction.integrated.commit.manuscript.nodes["fiction-paragraph"]?.domainRefs
    ).toContainEqual({ kind: "scene", id: "scene-12" });
    expect(fiction.variant.manuscript.nodes["fiction-paragraph"]?.domainRefs).toContainEqual({
      kind: "scene",
      id: "scene-12",
    });
    expect(fiction.integrated.commit.revision.provenanceRefs).toEqual(
      expect.arrayContaining([{ kind: "fiction.scene", id: "scene-12" }])
    );

    expect(
      fiction.integrated.commit.manuscript.nodes["fiction-paragraph"]?.contentRef?.version
    ).toBe(1);
    expect(fiction.variant.manuscript.nodes["fiction-paragraph"]?.contentRef?.version).toBe(1);
  });

  it("keeps the two fixtures independent while exercising the same Core collaboration semantics", () => {
    const essay = runEssayConsumerFixture();
    const fiction = runFictionConsumerFixture();

    expect(essay.graph.projectId).toBe("essay-project");
    expect(fiction.integrated.commit.graph.projectId).toBe("fiction-project");
    expect(essay.manuscript.rootId).not.toBe(fiction.canonicalManuscript.rootId);

    expect(essay.graph.branches["essay-draft"]?.kind).toBe("workspace");
    expect(fiction.integrated.commit.graph.branches["fiction-workspace"]?.kind).toBe(
      "workspace"
    );
  });
});
