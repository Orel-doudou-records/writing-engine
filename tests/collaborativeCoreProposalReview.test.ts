import { describe, expect, it } from "vitest";
import {
  ProposalSchema,
  createLiteraryManuscript,
  createProposal,
  createRevisionGraph,
  createChangeSet,
  createWorkBranch,
  commitChangeSet,
  submitProposal,
  reviewProposalSelection,
  integrateProposal,
  type ContributorRef,
  type LiteraryManuscript,
  type RevisionGraph,
} from "../src/index.js";

const author: ContributorRef = { id: "author-1" };
const editor: ContributorRef = { id: "editor-1" };
const now = "2026-09-11T19:50:00.000Z";

function setup(): {
  graph: RevisionGraph;
  canonicalManuscript: LiteraryManuscript;
} {
  const canonicalManuscript = createLiteraryManuscript({
    id: "manuscript-1",
    children: [
      {
        id: "chapter-1",
        kind: "chapter",
        title: "Chapter One",
        children: [
          {
            id: "p-1",
            kind: "paragraph",
            content: "Original paragraph.",
            createdBy: author,
            createdAt: now,
          },
        ],
      },
    ],
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

  const source = commitChangeSet({
    graph,
    manuscript: canonicalManuscript,
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
        {
          kind: "update_node_metadata",
          baseRevisionId: "r0",
          nodeId: "chapter-1",
          metadata: { title: "A title the author may reject" },
        },
      ],
    }),
    author: editor,
    createdAt: "2026-09-11T19:51:00.000Z",
    provenanceRefs: [{ kind: "autoessay.claim", id: "claim-1" }],
  });

  return { graph: source.graph, canonicalManuscript };
}

function createTwoItemProposal(graph: RevisionGraph) {
  return createProposal({
    graph,
    id: "proposal-1",
    projectId: "project-1",
    sourceBranchId: "workspace-edit",
    sourceHeadRevisionId: "r-work",
    baseRevisionId: "r0",
    proposer: editor,
    createdAt: "2026-09-11T19:52:00.000Z",
    provenanceRefs: [{ kind: "editorial_task", id: "task-7" }],
    items: [
      { id: "item-content", sourceRevisionId: "r-work", changeIndex: 0 },
      { id: "item-title", sourceRevisionId: "r-work", changeIndex: 1 },
    ],
  });
}

describe("Collaborative Manuscript Core proposals and reviews", () => {
  it("creates a proposal from a strict subset of source changes", () => {
    const { graph } = setup();
    const proposal = createProposal({
      graph,
      id: "proposal-subset",
      projectId: "project-1",
      sourceBranchId: "workspace-edit",
      sourceHeadRevisionId: "r-work",
      baseRevisionId: "r0",
      proposer: editor,
      createdAt: now,
      items: [{ id: "only-content", sourceRevisionId: "r-work", changeIndex: 0 }],
    });

    expect(proposal.items).toHaveLength(1);
    expect(proposal.items[0]).toMatchObject({
      id: "only-content",
      sourceRevisionId: "r-work",
      changeSetId: "cs-work",
      changeIndex: 0,
    });
    expect(proposal.sourceBranchId).toBe("workspace-edit");
    expect(proposal.baseRevisionId).toBe("r0");
    expect(proposal.status).toBe("draft");
    expect(ProposalSchema.parse(proposal)).toEqual(proposal);
  });

  it("projects batch review into explicit per-change decisions and keeps comments non-decisive", () => {
    const { graph } = setup();
    let proposal = submitProposal(createTwoItemProposal(graph), {
      submittedAt: "2026-09-11T19:53:00.000Z",
    });

    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-content", "item-title"],
      decision: "comment",
      reviewer: author,
      authorized: true,
      comment: "I want to decide these separately.",
      decisionIdPrefix: "comment",
      createdAt: "2026-09-11T19:54:00.000Z",
    });
    expect(proposal.status).toBe("submitted");

    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-content"],
      decision: "accept",
      reviewer: author,
      authorized: true,
      decisionIdPrefix: "accept",
      createdAt: "2026-09-11T19:55:00.000Z",
    });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-title"],
      decision: "reject",
      reviewer: author,
      authorized: true,
      comment: "Keep the chapter title.",
      decisionIdPrefix: "reject",
      createdAt: "2026-09-11T19:56:00.000Z",
    });

    expect(proposal.status).toBe("approved");
    expect(proposal.reviewDecisions).toHaveLength(4);
    expect(proposal.reviewDecisions.filter((entry) => entry.decision === "comment")).toHaveLength(2);
    expect(proposal.reviewDecisions.some((entry) => entry.itemId === "item-title" && entry.decision === "reject")).toBe(true);
  });

  it("uses request_changes as an explicit lifecycle state", () => {
    const { graph } = setup();
    let proposal = submitProposal(createTwoItemProposal(graph), { submittedAt: now });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-content"],
      decision: "request_changes",
      reviewer: author,
      authorized: true,
      comment: "Rewrite this passage again.",
      decisionIdPrefix: "changes",
      createdAt: now,
    });
    expect(proposal.status).toBe("changes_requested");
  });

  it("integrates only accepted authorized changes and preserves review/provenance links", () => {
    const { graph, canonicalManuscript } = setup();
    let proposal = submitProposal(createTwoItemProposal(graph), { submittedAt: now });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-content"],
      decision: "accept",
      reviewer: author,
      authorized: true,
      decisionIdPrefix: "accept",
      createdAt: "2026-09-11T19:55:00.000Z",
    });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-title"],
      decision: "reject",
      reviewer: author,
      authorized: true,
      comment: "No title change.",
      decisionIdPrefix: "reject",
      createdAt: "2026-09-11T19:56:00.000Z",
    });

    const integrated = integrateProposal({
      proposal,
      graph,
      manuscript: canonicalManuscript,
      targetBranchId: "main",
      expectedHeadRevisionId: "r0",
      revisionId: "r-integrated",
      integrationId: "integration-1",
      integrator: editor,
      createdAt: "2026-09-11T19:57:00.000Z",
      additionalParentIds: ["r-work"],
    });

    expect(integrated.proposal.status).toBe("integrated");
    expect(integrated.integration.acceptedItemIds).toEqual(["item-content"]);
    expect(integrated.integration.rejectedItemIds).toEqual(["item-title"]);
    expect(integrated.commit.revision.parentIds).toEqual(["r0", "r-work"]);
    expect(integrated.commit.manuscript.nodes["p-1"].contentRef?.version).toBe(2);
    expect(integrated.commit.manuscript.nodes["chapter-1"].title).toBe("Chapter One");
    expect(integrated.commit.revision.provenanceRefs).toEqual(
      expect.arrayContaining([
        { kind: "proposal", id: "proposal-1" },
        { kind: "review_decision", id: "accept:item-content" },
        { kind: "review_decision", id: "reject:item-title" },
        { kind: "editorial_task", id: "task-7" },
        { kind: "autoessay.claim", id: "claim-1" },
      ])
    );
    expect(integrated.proposal.reviewDecisions).toHaveLength(2);
  });

  it("never integrates an unauthorized acceptance", () => {
    const { graph, canonicalManuscript } = setup();
    let proposal = submitProposal(createTwoItemProposal(graph), { submittedAt: now });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-content"],
      decision: "accept",
      reviewer: { id: "reviewer-advisory" },
      authorized: false,
      decisionIdPrefix: "advisory",
      createdAt: now,
    });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["item-title"],
      decision: "reject",
      reviewer: author,
      authorized: true,
      decisionIdPrefix: "reject",
      createdAt: now,
    });

    expect(() =>
      integrateProposal({
        proposal,
        graph,
        manuscript: canonicalManuscript,
        targetBranchId: "main",
        expectedHeadRevisionId: "r0",
        revisionId: "r-nope",
        integrationId: "integration-nope",
        integrator: editor,
        createdAt: now,
      })
    ).toThrow(/no accepted authorized changes/);
  });

  it("lets one contributor carry proposer, reviewer and integrator responsibilities without a special path", () => {
    const { graph, canonicalManuscript } = setup();
    const authorEditor = { id: "author-editor" };
    let proposal = createProposal({
      graph,
      id: "proposal-solo",
      projectId: "project-1",
      sourceBranchId: "workspace-edit",
      sourceHeadRevisionId: "r-work",
      baseRevisionId: "r0",
      proposer: authorEditor,
      createdAt: now,
      items: [{ id: "solo-item", sourceRevisionId: "r-work", changeIndex: 0 }],
    });
    proposal = submitProposal(proposal, { submittedAt: now });
    proposal = reviewProposalSelection(proposal, {
      itemIds: ["solo-item"],
      decision: "accept",
      reviewer: authorEditor,
      authorized: true,
      decisionIdPrefix: "solo-accept",
      createdAt: now,
    });

    const integrated = integrateProposal({
      proposal,
      graph,
      manuscript: canonicalManuscript,
      targetBranchId: "main",
      expectedHeadRevisionId: "r0",
      revisionId: "r-solo",
      integrationId: "integration-solo",
      integrator: authorEditor,
      createdAt: now,
    });

    expect(integrated.commit.revision.author.id).toBe("author-editor");
    expect(integrated.proposal.status).toBe("integrated");
  });
});
