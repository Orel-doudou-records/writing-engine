import { describe, expect, it } from "vitest";
import {
  createContentVersion,
  createInMemoryCollaborativeCoreStore,
  createLiteraryManuscript,
  createRevisionGraph,
  createWorkBranch,
  createTranslationContribution,
  assessTranslationSource,
  commitChangeSet,
  createChangeSet,
  integrateTranslationProposal,
  persistCommit,
  reviewProposalSelection,
  type Proposal,
  type CollaborativeCoreStore,
  type PrepareTranslationInput,
  type TranslationBinding,
  insertLiteraryNode,
  prepareTranslation,
} from "../src/index.js";

const at = "2026-09-19T08:00:00.000Z";
const translator = { id: "translator", kind: "human" as const, displayName: "Translator" };
const contribution = {
  contributor: translator,
  roleBinding: { contributorId: translator.id, roleIds: [] },
  policy: { projectId: "target", defaultMode: "propose" as const, rules: [] },
  permissionGrants: [{
    id: "translate", projectId: "target", contributorId: translator.id,
    operation: "replace_content" as const,
  }],
  texts: ["p1", "p2"].map((targetNodeId) => ({ targetNodeId, content: `ترجمة ${targetNodeId}\n` })),
  revisionId: "translated", changeSetId: "translation-changes", proposalId: "proposal-1", createdAt: at,
};
const integration = {
  expectedHeadRevisionId: "r0", revisionId: "integrated", integrationId: "integration-1",
  integrator: { id: "editor" }, createdAt: at,
};

function review(proposal: Proposal, itemIds: string[], decision: "accept" | "reject" = "accept") {
  return reviewProposalSelection(proposal, {
    itemIds, decision, reviewer: { id: "editor" }, authorized: true,
    decisionIdPrefix: decision, createdAt: at,
  });
}

async function advance(store: CollaborativeCoreStore, projectId: string, branchId: string, revisionId: string, content = "Changed source") {
  const graph = (await store.loadRevisionGraph(projectId))!;
  const head = graph.branches[branchId].headRevisionId;
  const commit = commitChangeSet({
    graph, manuscript: (await store.loadManuscriptAtRevision(projectId, head))!,
    branchId, revisionId, expectedHeadRevisionId: head, author: { id: "author" }, createdAt: at,
    changeSet: createChangeSet({ id: `${projectId}-${revisionId}`, changes: [{ kind: "replace_content", nodeId: "p1", baseRevisionId: head, content }] }),
  });
  await persistCommit(store, { projectId, expectedHeadRevisionId: head, commit });
}

async function fixture() {
  const store = createInMemoryCollaborativeCoreStore();
  for (const projectId of ["source", "target"]) {
    let manuscript = createLiteraryManuscript({ id: `${projectId}-root` });
    const versions = ["p1", "p2"].map((nodeId) => createContentVersion({
      nodeId, version: 1, content: projectId === "source" ? `  ${nodeId}\n\n` : "",
      createdBy: { id: "author" }, createdAt: at,
    }));
    for (const version of versions) {
      manuscript = insertLiteraryNode(manuscript, {
        id: version.nodeId, kind: "paragraph", parentId: manuscript.rootId,
        contentRef: { nodeId: version.nodeId, version: 1 },
      });
    }
    let graph = createRevisionGraph({
      projectId, branchId: "main", revisionId: "r0", author: { id: "author" }, createdAt: at,
    });
    graph = createWorkBranch(graph, { id: "work", kind: "workspace", fromRevisionId: "r0" });
    await store.initializeProject({ graph, manuscript, contentVersions: versions });
  }
  const input = {
    id: "translation-1",
    source: { projectId: "source", branchId: "main", revisionId: "r0", language: "pt-br" },
    target: { projectId: "target", branchId: "work", revisionId: "r0", language: "ar" },
    mappings: ["p1", "p2"].map((nodeId) => ({ sourceNodeId: nodeId, targetNodeId: nodeId })),
  };
  return { store, input };
}

describe("optional translation process", () => {
  it("pins exact source content, languages and mappings without changing either project", async () => {
    const { store, input } = await fixture();
    const before = await store.loadRevisionGraph("target");
    const request = await prepareTranslation(store, input);
    expect(request.source.language).toBe("pt-BR");
    expect(request.target.language).toBe("ar");
    expect(request.units[0].source.content).toBe("  p1\n\n");
    expect(request.units[0].source.version).toBe(1);
    expect(request.units[0].targetNodeId).toBe("p1");
    expect(Object.isFrozen(request.units[0].source)).toBe(true);
    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
    expect(await store.loadRevisionGraph("target")).toEqual(before);
    expect((await store.loadRevisionGraph("source"))?.branches.main.headRevisionId).toBe("r0");
  });

  it("creates an ordinary submitted proposal and provenance without persisting it", async () => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const result = await createTranslationContribution(store, { ...contribution, request });
    expect(result.binding.mode).toBe("propose");
    expect(result.proposal?.status).toBe("submitted");
    expect(result.proposal?.reviewDecisions).toEqual([]);
    expect(result.proposal?.items).toHaveLength(2);
    expect(result.commit.contentVersions.map((version) => version.content)).toEqual(contribution.texts.map((text) => text.content));
    expect(result.commit.revision.provenanceRefs).toContainEqual({ kind: "translation_request", id: request.id });
    expect((await store.loadRevisionGraph("target"))?.branches.work.headRevisionId).toBe("r0");
    expect(Object.isFrozen(result.binding.request.units)).toBe(true);
  });

  it("integrates only accepted translations through normal review and preserves the source", async () => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const result = await createTranslationContribution(store, { ...contribution, request });
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "r0", commit: result.commit });
    let proposal = review(result.proposal!, [result.proposal!.items[0].id]);
    proposal = review(proposal, [proposal.items[1].id], "reject");
    const merged = await integrateTranslationProposal(store, { ...integration, binding: result.binding, proposal });
    expect(merged.integratedUnits.map((unit) => unit.targetNodeId)).toEqual(["p1"]);
    expect(merged.commit.contentVersions.map((version) => version.content)).toEqual([contribution.texts[0].content]);
    expect(merged.commit.manuscript.nodes.p2.contentRef?.version).toBe(1);
    expect(merged.integration.provenanceRefs).toContainEqual({ kind: "translation_request", id: request.id });
    expect((await store.loadRevisionGraph("target"))?.branches.main.headRevisionId).toBe("r0");
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "r0", commit: merged.commit });
    expect((await store.loadRevisionGraph("target"))?.branches.main.headRevisionId).toBe("integrated");
    expect((await store.loadRevisionGraph("source"))?.branches.main.headRevisionId).toBe("r0");
  });

  it("marks a moved source stale, blocks old approvals and starts a fresh request without decisions", async () => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    expect(await assessTranslationSource(store, request)).toEqual({ status: "current", currentRevisionId: "r0" });
    const result = await createTranslationContribution(store, { ...contribution, request });
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "r0", commit: result.commit });
    const proposal = review(result.proposal!, result.proposal!.items.map((item) => item.id));
    await advance(store, "source", "main", "source-new");
    expect(await assessTranslationSource(store, request)).toEqual({ status: "stale", currentRevisionId: "source-new" });
    await expect(integrateTranslationProposal(store, { ...integration, binding: result.binding, proposal })).rejects.toThrow("source changed");
    const fresh = await prepareTranslation(store, {
      ...input, id: "translation-2", source: { ...input.source, revisionId: "source-new" },
      target: { ...input.target, revisionId: result.commit.revision.id },
    });
    const retry = await createTranslationContribution(store, {
      ...contribution, request: fresh, proposalId: "proposal-2", revisionId: "translated-again", changeSetId: "retry",
    });
    expect(retry.proposal?.reviewDecisions).toEqual([]);
    expect(retry.proposal?.status).toBe("submitted");
    expect(fresh.units[0].source.content).toBe("Changed source");
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "translated", commit: retry.commit });
    await expect(integrateTranslationProposal(store, { ...integration, binding: retry.binding, proposal })).rejects.toThrow();
    const reviewedAgain = review(retry.proposal!, retry.proposal!.items.map((item) => item.id));
    const merged = await integrateTranslationProposal(store, { ...integration, binding: retry.binding, proposal: reviewedAgain });
    expect(merged.integratedUnits).toHaveLength(2);
  });

  it.each(["human", "agent"] as const)("uses the project policy for a %s and keeps direct writes in the workspace", async (kind) => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const result = await createTranslationContribution(store, {
      ...contribution, request, contributor: { ...translator, kind },
      policy: { ...contribution.policy, defaultMode: "direct" },
    });
    expect(result.binding.mode).toBe("direct");
    expect(result.proposal).toBeUndefined();
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "r0", commit: result.commit });
    expect((await store.loadRevisionGraph("target"))?.branches.main.headRevisionId).toBe("r0");
    expect((await store.loadRevisionGraph("target"))?.branches.work.headRevisionId).toBe("translated");
  });

  it("requires a proposal if any mapped node requires review", async () => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const result = await createTranslationContribution(store, {
      ...contribution, request,
      policy: { projectId: "target", defaultMode: "direct", rules: [{
        id: "review-p2", scope: { kind: "node", nodeId: "p2" }, mode: "propose",
      }] },
    });
    expect(result.proposal?.items).toHaveLength(2);
    expect(result.binding.mode).toBe("propose");
  });

  it.each(["missing node", "wrong contributor", "wrong project", "range only"])("rejects insufficient grants: %s", async (reason) => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const grant = contribution.permissionGrants[0];
    const permissionGrants = reason === "missing node" ? [{ ...grant, scope: { kind: "node" as const, nodeId: "p1" } }]
      : reason === "wrong contributor" ? [{ ...grant, contributorId: "someone-else" }]
      : reason === "wrong project" ? [{ ...grant, projectId: "source" }]
      : [{ ...grant, scope: { kind: "node" as const, nodeId: "p1", range: { start: 0, end: 1 } } }];
    await expect(createTranslationContribution(store, { ...contribution, request, permissionGrants })).rejects.toThrow("requires permission");
    expect((await store.loadRevisionGraph("target"))?.branches.work.headRevisionId).toBe("r0");
  });

  it.each([
    ["empty", []],
    ["incomplete", [contribution.texts[0]]],
    ["duplicate", [contribution.texts[0], contribution.texts[0]]],
    ["unknown", [contribution.texts[0], { targetNodeId: "other", content: "Extra" }]],
  ])("rejects %s translation coverage", async (_, texts) => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    await expect(createTranslationContribution(store, { ...contribution, request, texts })).rejects.toThrow("exactly once");
  });

  const invalidPreparations: [string, (input: PrepareTranslationInput) => PrepareTranslationInput][] = [
    ["same languages", (input) => ({ ...input, target: { ...input.target, language: "pt-BR" } })],
    ["invalid language", (input) => ({ ...input, target: { ...input.target, language: "not_a_tag" } })],
    ["canonical target", (input) => ({ ...input, target: { ...input.target, branchId: "main" } })],
    ["source overwrite during integration", (input) => ({ ...input, target: { ...input.target, projectId: "source" } })],
    ["unknown revision", (input) => ({ ...input, source: { ...input.source, revisionId: "absent" } })],
    ["unknown node", (input) => ({ ...input, mappings: [{ sourceNodeId: "absent", targetNodeId: "p1" }] })],
    ["non-text source", (input) => ({ ...input, mappings: [{ sourceNodeId: "source-root", targetNodeId: "p1" }] })],
    ["non-text target", (input) => ({ ...input, mappings: [{ sourceNodeId: "p1", targetNodeId: "target-root" }] })],
    ["duplicate mapping", (input) => ({ ...input, mappings: [input.mappings[0], input.mappings[0]] })],
  ];
  it.each(invalidPreparations)("rejects %s", async (_, change) => {
    const { store, input } = await fixture();
    await expect(prepareTranslation(store, change(input))).rejects.toThrow();
  });

  it("rejects variant destinations and source-workspace overwrites", async () => {
    const { store, input } = await fixture();
    const graph = createWorkBranch((await store.loadRevisionGraph("target"))!, { id: "variant", kind: "variant", fromRevisionId: "r0" });
    await store.createBranch("target", graph.branches.variant);
    await expect(prepareTranslation(store, { ...input, target: { ...input.target, branchId: "variant" } })).rejects.toThrow("non-canonical workspace");
    await expect(prepareTranslation(store, {
      ...input, source: { ...input.source, branchId: "work" }, target: { ...input.target, projectId: "source" },
    })).rejects.toThrow("preserve the source");
  });

  it("resolves identical node/version ordinals in the selected branch and supports same-project translation", async () => {
    const { store, input } = await fixture();
    await advance(store, "source", "main", "canonical-2", "Canonical version two");
    await advance(store, "source", "work", "workspace-2", "Workspace version two");
    const graph = createWorkBranch((await store.loadRevisionGraph("source"))!, { id: "translation-work", kind: "workspace", fromRevisionId: "canonical-2" });
    await store.createBranch("source", graph.branches["translation-work"]);
    const request = await prepareTranslation(store, {
      ...input, source: { ...input.source, branchId: "work", revisionId: "workspace-2", language: "fr" },
      target: { ...input.target, projectId: "source", branchId: "translation-work", revisionId: "canonical-2", language: "zh-Hant" },
    });
    expect(request.units[0].source.version).toBe(2);
    expect(request.units[0].source.content).toBe("Workspace version two");
    const result = await createTranslationContribution(store, {
      ...contribution, request, policy: { ...contribution.policy, projectId: "source" },
      permissionGrants: [{ ...contribution.permissionGrants[0], projectId: "source" }],
    });
    await persistCommit(store, { projectId: "source", expectedHeadRevisionId: "canonical-2", commit: result.commit });
    const proposal = review(result.proposal!, result.proposal!.items.map((item) => item.id));
    const merged = await integrateTranslationProposal(store, { ...integration, expectedHeadRevisionId: "canonical-2", binding: result.binding, proposal });
    await persistCommit(store, { projectId: "source", expectedHeadRevisionId: "canonical-2", commit: merged.commit });
    expect((await store.loadRevisionGraph("source"))?.branches.work.headRevisionId).toBe("workspace-2");
    expect((await store.resolveContentVersion("source", "workspace-2", "p1", 2))?.content).toBe("Workspace version two");
  });

  it.each([["source", "main"], ["target", "work"], ["target", "main"]])("blocks contribution after %s/%s advances", async (project, branch) => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    await advance(store, project, branch, "changed");
    await expect(createTranslationContribution(store, { ...contribution, request })).rejects.toThrow("changed");
  });

  it("rejects altered source text even with a matching replacement hash", async () => {
    const { store, input } = await fixture();
    const request = JSON.parse(JSON.stringify(await prepareTranslation(store, input)));
    request.units[0].source = createContentVersion({ nodeId: "p1", version: 1, content: "Fabricated source", createdBy: { id: "author" }, createdAt: at });
    await expect(createTranslationContribution(store, { ...contribution, request })).rejects.toThrow("provenance mismatch");
  });

  it("reports a missing source and propagates storage failures", async () => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    expect(await assessTranslationSource(createInMemoryCollaborativeCoreStore(), request)).toEqual({ status: "missing" });
    await expect(assessTranslationSource({ ...store, loadRevisionGraph: async () => { throw new Error("offline"); } }, request)).rejects.toThrow("offline");
  });

  it.each(["unreviewed", "unauthorized", "editorial conflict", "different proposal", "different request", "changed target"])("blocks integration: %s", async (reason) => {
    const { store, input } = await fixture();
    const request = await prepareTranslation(store, input);
    const result = await createTranslationContribution(store, { ...contribution, request });
    await persistCommit(store, { projectId: "target", expectedHeadRevisionId: "r0", commit: result.commit });
    let proposal = review(result.proposal!, result.proposal!.items.map((item) => item.id));
    const binding: TranslationBinding = JSON.parse(JSON.stringify(result.binding));
    if (reason === "unreviewed") proposal = result.proposal!;
    if (reason === "unauthorized") proposal = reviewProposalSelection(result.proposal!, {
      itemIds: proposal.items.map((item) => item.id), decision: "accept", reviewer: { id: "observer" },
      authorized: false, decisionIdPrefix: "not-allowed", createdAt: at,
    });
    if (reason === "different proposal") binding.proposalId = "other-proposal";
    if (reason === "different request") binding.request.target.language = "ja";
    if (reason === "changed target") await advance(store, "target", "main", "changed");
    const editorialConflicts = reason === "editorial conflict" ? [{ id: "review-needed", reason: "Meaning requires a decision" }] : [];
    await expect(integrateTranslationProposal(store, { ...integration, binding, proposal, editorialConflicts })).rejects.toThrow();
    expect((await store.loadRevisionGraph("target"))?.branches.main.headRevisionId).not.toBe("integrated");
  });
});
