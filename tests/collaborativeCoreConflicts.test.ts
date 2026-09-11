import { describe, expect, it } from "vitest";
import {
  ProposalConflictError,
  adaptStaleProposal,
  assessProposalIntegration,
  createChangeSet,
  createLiteraryManuscript,
  createProposal,
  createRevisionGraph,
  createWorkBranch,
  commitChangeSet,
  insertLiteraryNode,
  integrateProposal,
  reviewProposalSelection,
  submitProposal,
  type Change,
  type ContributorRef,
  type LiteraryManuscript,
  type Proposal,
  type RevisionGraph,
} from "../src/index.js";

const author: ContributorRef = { id: "author-1" };
const editor: ContributorRef = { id: "editor-1" };
const now = "2026-09-11T20:10:00.000Z";

function baseManuscript(): LiteraryManuscript {
  let manuscript = createLiteraryManuscript({ id: "m1", title: "Book" });
  manuscript = insertLiteraryNode(manuscript, {
    id: "c1",
    kind: "chapter",
    parentId: "m1",
    title: "One",
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "c2",
    kind: "chapter",
    parentId: "m1",
    title: "Two",
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "p1",
    kind: "paragraph",
    parentId: "c1",
    contentRef: { nodeId: "p1", version: 1 },
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "p2",
    kind: "paragraph",
    parentId: "c2",
    contentRef: { nodeId: "p2", version: 1 },
  });
  return manuscript;
}

function setupProposal(sourceChange: Change): {
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  proposal: Proposal;
} {
  const manuscript = baseManuscript();
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
  const source = commitChangeSet({
    graph,
    manuscript,
    branchId: "workspace-edit",
    revisionId: "r-work",
    expectedHeadRevisionId: "r0",
    changeSet: createChangeSet({ id: "cs-work", changes: [sourceChange] }),
    author: editor,
    createdAt: "2026-09-11T20:11:00.000Z",
  });
  let proposal = createProposal({
    graph: source.graph,
    id: "proposal-1",
    projectId: "project-1",
    sourceBranchId: "workspace-edit",
    sourceHeadRevisionId: "r-work",
    baseRevisionId: "r0",
    proposer: editor,
    createdAt: "2026-09-11T20:12:00.000Z",
    provenanceRefs: [{ kind: "task", id: "task-1" }],
    items: [{ id: "item-1", sourceRevisionId: "r-work", changeIndex: 0 }],
  });
  proposal = submitProposal(proposal, { submittedAt: "2026-09-11T20:13:00.000Z" });
  proposal = reviewProposalSelection(proposal, {
    itemIds: ["item-1"],
    decision: "accept",
    reviewer: author,
    authorized: true,
    decisionIdPrefix: "accept",
    createdAt: "2026-09-11T20:14:00.000Z",
  });
  return { graph: source.graph, manuscript, proposal };
}

function advanceCanonical(
  graph: RevisionGraph,
  manuscript: LiteraryManuscript,
  change: Change
) {
  return commitChangeSet({
    graph,
    manuscript,
    branchId: "main",
    revisionId: "r-main-1",
    expectedHeadRevisionId: "r0",
    changeSet: createChangeSet({ id: "cs-main-1", changes: [change] }),
    author,
    createdAt: "2026-09-11T20:15:00.000Z",
  });
}

describe("Collaborative Manuscript Core conflicts", () => {
  it("reports concurrent replacement of the same paragraph as stale version + textual conflict", () => {
    const setup = setupProposal({
      kind: "replace_content",
      baseRevisionId: "r0",
      nodeId: "p1",
      expectedContentVersion: { nodeId: "p1", version: 1 },
      content: "Proposed p1",
    });
    const current = advanceCanonical(setup.graph, setup.manuscript, {
      kind: "replace_content",
      baseRevisionId: "r0",
      nodeId: "p1",
      expectedContentVersion: { nodeId: "p1", version: 1 },
      content: "Current p1",
    });

    const assessment = assessProposalIntegration({
      proposal: setup.proposal,
      graph: current.graph,
      targetBranchId: "main",
    });

    expect(assessment.stale).toBe(true);
    expect(assessment.canAutoReconcile).toBe(false);
    expect(assessment.conflicts.map((conflict) => conflict.kind)).toEqual(
      expect.arrayContaining(["version", "textual"])
    );
    expect(assessment.conflicts.find((conflict) => conflict.kind === "textual")).toMatchObject({
      proposalItemId: "item-1",
      baseRevisionId: "r0",
      currentRevisionId: "r-main-1",
    });

    expect(() =>
      integrateProposal({
        proposal: setup.proposal,
        graph: current.graph,
        manuscript: current.manuscript,
        targetBranchId: "main",
        expectedHeadRevisionId: "r-main-1",
        revisionId: "r-integrated",
        integrationId: "integration-1",
        integrator: editor,
        createdAt: now,
      })
    ).toThrow(ProposalConflictError);
  });

  it("reports move + remove of the same node as a structural conflict", () => {
    const setup = setupProposal({
      kind: "move_node",
      baseRevisionId: "r0",
      nodeId: "p1",
      parentId: "c2",
    });
    const current = advanceCanonical(setup.graph, setup.manuscript, {
      kind: "remove_node",
      baseRevisionId: "r0",
      nodeId: "p1",
    });

    const assessment = assessProposalIntegration({
      proposal: setup.proposal,
      graph: current.graph,
      targetBranchId: "main",
    });
    expect(assessment.canAutoReconcile).toBe(false);
    expect(assessment.conflicts.some((conflict) => conflict.kind === "structural")).toBe(true);
  });

  it("auto-reconciles independent changes by adapting into a new workspace/proposal without mutating history", () => {
    const setup = setupProposal({
      kind: "replace_content",
      baseRevisionId: "r0",
      nodeId: "p1",
      expectedContentVersion: { nodeId: "p1", version: 1 },
      content: "Proposed p1",
    });
    const current = advanceCanonical(setup.graph, setup.manuscript, {
      kind: "replace_content",
      baseRevisionId: "r0",
      nodeId: "p2",
      expectedContentVersion: { nodeId: "p2", version: 1 },
      content: "Current p2",
    });

    const assessment = assessProposalIntegration({
      proposal: setup.proposal,
      graph: current.graph,
      targetBranchId: "main",
    });
    expect(assessment.stale).toBe(true);
    expect(assessment.canAutoReconcile).toBe(true);
    expect(assessment.conflicts.filter((conflict) => conflict.blocking)).toHaveLength(0);

    const adapted = adaptStaleProposal({
      proposal: setup.proposal,
      graph: current.graph,
      manuscript: current.manuscript,
      targetBranchId: "main",
      branchId: "workspace-adapted",
      revisionId: "r-adapted",
      changeSetId: "cs-adapted",
      proposalId: "proposal-adapted",
      contributor: editor,
      createdAt: "2026-09-11T20:16:00.000Z",
    });

    expect(adapted.staleProposal.status).toBe("stale");
    expect(adapted.staleProposal.baseRevisionId).toBe("r0");
    expect(adapted.staleProposal.reviewDecisions).toEqual(setup.proposal.reviewDecisions);
    expect(setup.proposal.status).toBe("approved");
    expect(adapted.proposal.id).toBe("proposal-adapted");
    expect(adapted.proposal.baseRevisionId).toBe("r-main-1");
    expect(adapted.proposal.sourceBranchId).toBe("workspace-adapted");
    expect(adapted.proposal.reviewDecisions[0]?.proposalId).toBe("proposal-adapted");
    expect(adapted.proposal.provenanceRefs).toContainEqual({
      kind: "adapted_from_proposal",
      id: "proposal-1",
    });

    const integrated = integrateProposal({
      proposal: adapted.proposal,
      graph: adapted.graph,
      manuscript: current.manuscript,
      targetBranchId: "main",
      expectedHeadRevisionId: "r-main-1",
      revisionId: "r-integrated",
      integrationId: "integration-1",
      integrator: editor,
      createdAt: "2026-09-11T20:17:00.000Z",
    });
    expect(integrated.commit.manuscript.nodes.p1?.contentRef?.version).toBe(2);
    expect(integrated.commit.manuscript.nodes.p2?.contentRef?.version).toBe(2);
  });

  it("blocks a declared editorial conflict even without a technical collision", () => {
    const setup = setupProposal({
      kind: "update_node_metadata",
      baseRevisionId: "r0",
      nodeId: "c1",
      metadata: { title: "New chapter title" },
    });

    const assessment = assessProposalIntegration({
      proposal: setup.proposal,
      graph: setup.graph,
      targetBranchId: "main",
      editorialConflicts: [
        {
          id: "editorial-1",
          proposalItemId: "item-1",
          reason: "The author explicitly retained the existing title in a separate editorial decision.",
          declaredBy: { kind: "review", id: "review-42" },
        },
      ],
    });

    expect(assessment.stale).toBe(false);
    expect(assessment.canAutoReconcile).toBe(false);
    expect(assessment.conflicts).toContainEqual(
      expect.objectContaining({
        kind: "editorial",
        blocking: true,
        proposalItemId: "item-1",
      })
    );
  });
});
