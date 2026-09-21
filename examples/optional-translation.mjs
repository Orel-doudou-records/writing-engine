import assert from "node:assert/strict";
import {
  createContentVersion,
  createInMemoryCollaborativeCoreStore,
  createLiteraryManuscript,
  createRevisionGraph,
  createWorkBranch,
  insertLiteraryNode,
  prepareTranslation,
  createTranslationContribution,
  reviewProposalSelection,
  integrateTranslationProposal,
  persistCommit,
} from "../dist/src/index.js";

// The consumer chooses whether to invoke translation. No provider is called.
if (!process.argv.includes("--translate")) {
  console.log("Translation was not requested. Pass --translate to run the example.");
} else {
  const store = createInMemoryCollaborativeCoreStore();
  const createdAt = "2026-09-19T08:00:00.000Z";
  for (const [projectId, content] of [["original", "A cidade acorda.\n"], ["arabic-edition", ""]]) {
    const version = createContentVersion({
      nodeId: "p1", version: 1, content, createdBy: { id: "author" }, createdAt,
    });
    const manuscript = insertLiteraryNode(createLiteraryManuscript({ id: "root" }), {
      id: "p1", kind: "paragraph", parentId: "root", contentRef: { nodeId: "p1", version: 1 },
    });
    const graph = createWorkBranch(createRevisionGraph({
      projectId, branchId: "main", revisionId: "r0", author: { id: "author" }, createdAt,
    }), { id: "translation-work", kind: "workspace", fromRevisionId: "r0" });
    await store.initializeProject({ graph, manuscript, contentVersions: [version] });
  }

  // In a real application, first authorize source read access and store this
  // request immutably in the application's transaction/storage layer.
  const request = await prepareTranslation(store, {
    id: "request-1",
    source: { projectId: "original", branchId: "main", revisionId: "r0", language: "pt-BR" },
    target: { projectId: "arabic-edition", branchId: "translation-work", revisionId: "r0", language: "ar" },
    mappings: [{ sourceNodeId: "p1", targetNodeId: "p1" }],
  });
  const contributor = { id: "translator", kind: "human", displayName: "Translator" };
  const contribution = await createTranslationContribution(store, {
    request, contributor, roleBinding: { contributorId: contributor.id, roleIds: [] },
    policy: { projectId: request.target.projectId, defaultMode: "propose", rules: [] },
    permissionGrants: [{
      id: "translation-grant", projectId: request.target.projectId,
      contributorId: contributor.id, operation: "replace_content", scope: { kind: "node", nodeId: "p1" },
    }],
    texts: [{ targetNodeId: "p1", content: "تستيقظ المدينة.\n" }],
    revisionId: "translated", changeSetId: "translation-changes", proposalId: "proposal-1", createdAt,
  });
  // No concurrent writer exists in this demonstration. Production must lock
  // the source and persist the commit, binding and proposal in one transaction.
  await persistCommit(store, {
    projectId: request.target.projectId, expectedHeadRevisionId: "r0", commit: contribution.commit,
  });
  await store.saveProposal(contribution.proposal);

  // Only the host application's trusted authorization layer may supply true.
  const proposal = reviewProposalSelection(contribution.proposal, {
    itemIds: contribution.proposal.items.map((item) => item.id), decision: "accept",
    reviewer: { id: "editor" }, authorized: true, decisionIdPrefix: "review-1", createdAt,
  });
  await store.appendReviewDecisions(request.target.projectId, proposal.reviewDecisions);
  await store.saveProposal(proposal);
  const merged = await integrateTranslationProposal(store, {
    binding: contribution.binding, proposal, expectedHeadRevisionId: "r0",
    revisionId: "integrated", integrationId: "integration-1", integrator: { id: "editor" }, createdAt,
  });
  await persistCommit(store, {
    projectId: request.target.projectId, expectedHeadRevisionId: "r0", commit: merged.commit,
  });
  await store.saveIntegration(request.target.projectId, merged.integration);
  await store.saveProposal(merged.proposal);

  assert.equal((await store.loadRevisionGraph("original")).branches.main.headRevisionId, "r0");
  assert.equal(merged.integratedUnits.length, 1);
  console.log(JSON.stringify({
    languages: [request.source.language, request.target.language],
    status: merged.proposal.status,
    sourceRevision: request.source.revisionId,
    translatedText: merged.commit.contentVersions[0].content,
  }, null, 2));
}
