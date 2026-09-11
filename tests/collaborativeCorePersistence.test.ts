import { describe, expect, it } from "vitest";
import {
  createChangeSet,
  createContentVersion,
  createInMemoryCollaborativeCoreStore,
  createLiteraryManuscript,
  createProposal,
  createRevisionGraph,
  createWorkBranch,
  insertLiteraryNode,
  integrateProposal,
  persistCommit,
  reviewProposalSelection,
  submitProposal,
  type CollaborativeCoreStore,
  type ContributorRef,
  type Task,
} from "../src/index.js";
import { commitChangeSet } from "../src/collaborative-core/versioning.js";

const author: ContributorRef = { id: "author-1" };
const editor: ContributorRef = { id: "editor-1" };
const now = "2026-09-11T20:20:00.000Z";

async function seedStore(store: CollaborativeCoreStore) {
  const v1 = createContentVersion({
    nodeId: "p-1",
    version: 1,
    content: "Original paragraph.",
    createdBy: author,
    createdAt: now,
  });

  let manuscript = createLiteraryManuscript({ id: "manuscript-1", title: "Book" });
  manuscript = insertLiteraryNode(manuscript, {
    id: "chapter-1",
    kind: "chapter",
    parentId: "manuscript-1",
    title: "Chapter One",
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "p-1",
    kind: "paragraph",
    parentId: "chapter-1",
    contentRef: { nodeId: "p-1", version: 1 },
  });

  let graph = createRevisionGraph({
    projectId: "project-1",
    branchId: "main",
    revisionId: "r0",
    author,
    createdAt: now,
  });
  graph = createWorkBranch(graph, {
    id: "workspace-edit",
    kind: "workspace",
    fromRevisionId: "r0",
  });

  await store.initializeProject({
    graph,
    manuscript,
    contentVersions: [v1],
  });

  return { graph, manuscript, v1 };
}

async function runPersistenceContract(factory: () => CollaborativeCoreStore) {
  const store = factory();
  const { manuscript: baseManuscript } = await seedStore(store);

  const task: Task = {
    id: "task-1",
    projectId: "project-1",
    title: "Revise paragraph",
    status: "in_progress",
    assignee: {
      contributorId: "editor-1",
      scope: { kind: "node", nodeId: "p-1" },
    },
    reviewers: [],
    collaborators: [],
    workspaceBranchId: "workspace-edit",
  };
  await store.saveTask(task);
  expect(await store.loadTask("project-1", "task-1")).toEqual(task);

  const graphBeforeRevision = await store.loadRevisionGraph("project-1");
  const workspaceBeforeRevision = await store.loadCurrentManuscript(
    "project-1",
    "workspace-edit"
  );
  expect(graphBeforeRevision).toBeDefined();
  expect(workspaceBeforeRevision).toBeDefined();

  const revised = commitChangeSet({
    graph: graphBeforeRevision!,
    manuscript: workspaceBeforeRevision!,
    branchId: "workspace-edit",
    revisionId: "r-work",
    expectedHeadRevisionId: "r0",
    changeSet: createChangeSet({
      id: "cs-work",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "r0",
          nodeId: "p-1",
          expectedContentVersion: { nodeId: "p-1", version: 1 },
          content: "Revised paragraph.",
        },
      ],
    }),
    author: editor,
    createdAt: "2026-09-11T20:21:00.000Z",
    provenanceRefs: [{ kind: "editorial_task", id: "task-1" }],
  });

  await persistCommit(store, {
    projectId: "project-1",
    expectedHeadRevisionId: "r0",
    commit: revised,
  });

  expect(
    await store.resolveContentVersion("project-1", "p-1", 2)
  ).toMatchObject({ content: "Revised paragraph." });
  expect((await store.loadRevision("project-1", "r-work"))?.id).toBe("r-work");
  expect((await store.loadChangeSet("project-1", "cs-work"))?.id).toBe("cs-work");

  const proposalGraph = await store.loadRevisionGraph("project-1");
  let proposal = createProposal({
    graph: proposalGraph!,
    id: "proposal-1",
    projectId: "project-1",
    sourceBranchId: "workspace-edit",
    sourceHeadRevisionId: "r-work",
    baseRevisionId: "r0",
    proposer: editor,
    createdAt: "2026-09-11T20:22:00.000Z",
    provenanceRefs: [{ kind: "editorial_task", id: "task-1" }],
    items: [{ id: "item-1", sourceRevisionId: "r-work", changeIndex: 0 }],
  });
  proposal = submitProposal(proposal, {
    submittedAt: "2026-09-11T20:23:00.000Z",
  });
  await store.saveProposal(proposal);

  const reviewed = reviewProposalSelection(proposal, {
    itemIds: ["item-1"],
    decision: "accept",
    reviewer: author,
    authorized: true,
    decisionIdPrefix: "accept",
    createdAt: "2026-09-11T20:24:00.000Z",
  });
  await store.appendReviewDecisions(
    "project-1",
    reviewed.reviewDecisions.slice(proposal.reviewDecisions.length)
  );
  await store.saveProposal(reviewed);

  const mainBeforeIntegration = await store.loadCurrentManuscript("project-1", "main");
  const graphBeforeIntegration = await store.loadRevisionGraph("project-1");
  const integrated = integrateProposal({
    proposal: reviewed,
    graph: graphBeforeIntegration!,
    manuscript: mainBeforeIntegration!,
    targetBranchId: "main",
    expectedHeadRevisionId: "r0",
    revisionId: "r-integrated",
    integrationId: "integration-1",
    integrator: editor,
    createdAt: "2026-09-11T20:25:00.000Z",
    additionalParentIds: ["r-work"],
  });

  await persistCommit(store, {
    projectId: "project-1",
    expectedHeadRevisionId: "r0",
    commit: integrated.commit,
  });
  await store.saveIntegration(integrated.integration);
  await store.saveProposal(integrated.proposal);

  expect((await store.loadCurrentManuscript("project-1", "main"))?.nodes["p-1"].contentRef).toEqual({
    nodeId: "p-1",
    version: 2,
  });
  expect((await store.loadManuscriptAtRevision("project-1", "r0"))?.nodes["p-1"].contentRef).toEqual({
    nodeId: "p-1",
    version: 1,
  });
  expect((await store.loadSnapshot("project-1", "r-integrated"))?.revisionId).toBe(
    "r-integrated"
  );
  expect(await store.walkRevisionAncestors("project-1", "r-integrated")).toEqual(
    expect.arrayContaining(["r0", "r-work"])
  );
  expect((await store.loadIntegration("project-1", "integration-1"))?.proposalId).toBe(
    "proposal-1"
  );
  expect(await store.loadReviewDecisions("project-1", "proposal-1")).toHaveLength(1);

  expect(await store.loadManuscriptAtRevision("project-1", "r0")).toEqual(baseManuscript);
}

describe("Collaborative Manuscript Core persistence", () => {
  it("runs the complete workflow through the storage port", async () => {
    await runPersistenceContract(() => createInMemoryCollaborativeCoreStore());
  });

  it("atomically rejects an unexpected branch head without moving it", async () => {
    const store = createInMemoryCollaborativeCoreStore();
    await seedStore(store);

    await store.advanceBranchHead({
      projectId: "project-1",
      branchId: "workspace-edit",
      expectedHeadRevisionId: "r0",
      nextHeadRevisionId: "r0",
    });

    await expect(
      store.advanceBranchHead({
        projectId: "project-1",
        branchId: "workspace-edit",
        expectedHeadRevisionId: "not-the-head",
        nextHeadRevisionId: "r0",
      })
    ).rejects.toThrow(/branch head mismatch/);

    expect((await store.loadRevisionGraph("project-1"))?.branches["workspace-edit"].headRevisionId).toBe(
      "r0"
    );
  });

  it("keeps immutable records addressable and rejects conflicting rewrites", async () => {
    const store = createInMemoryCollaborativeCoreStore();
    const { v1 } = await seedStore(store);

    await store.appendContentVersions("project-1", [v1]);
    await expect(
      store.appendContentVersions("project-1", [{ ...v1, content: "Mutated history" }])
    ).rejects.toThrow(/immutable content version conflict/);

    expect(await store.resolveContentVersion("project-1", "p-1", 1)).toEqual(v1);
  });
});
