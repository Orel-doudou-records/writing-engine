import {
  ContributionPolicySchema,
  ContributorSchema,
  PermissionGrantSchema,
  RoleBindingSchema,
  authorizeContribution,
  commitChangeSet,
  createChangeSet,
  createLiteraryManuscript,
  createProposal,
  createRevisionGraph,
  createWorkBranch,
  insertLiteraryNode,
  integrateProposal,
  reviewProposalSelection,
  submitProposal,
} from "../../src/index.js";

export function runFictionConsumerFixture() {
  const contributor = ContributorSchema.parse({
    id: "fiction-structural-agent",
    kind: "agent",
    displayName: "Fiction structural agent",
  });
  const roleBinding = RoleBindingSchema.parse({
    contributorId: contributor.id,
    roleIds: ["structural-editor"],
  });
  const policy = ContributionPolicySchema.parse({
    projectId: "fiction-project",
    defaultMode: "propose",
    rules: [],
  });
  const permission = PermissionGrantSchema.parse({
    id: "fiction-suggest",
    projectId: "fiction-project",
    contributorId: contributor.id,
    operation: "replace_content",
  });
  const authorization = authorizeContribution({
    policy,
    contributor,
    roleBinding,
    permissionGrants: [permission],
    projectId: "fiction-project",
    operation: "replace_content",
    scope: { kind: "node", nodeId: "fiction-paragraph" },
  });

  let canonicalManuscript = createLiteraryManuscript({
    id: "fiction-manuscript",
    title: "Novel",
  });
  canonicalManuscript = insertLiteraryNode(canonicalManuscript, {
    id: "fiction-chapter",
    kind: "chapter",
    parentId: "fiction-manuscript",
    title: "Chapter One",
  });
  canonicalManuscript = insertLiteraryNode(canonicalManuscript, {
    id: "fiction-paragraph",
    kind: "paragraph",
    parentId: "fiction-chapter",
    domainRefs: [{ kind: "scene", id: "scene-12" }],
  });

  let graph = createRevisionGraph({
    projectId: "fiction-project",
    branchId: "main",
    revisionId: "fiction-r0",
    author: { id: "fiction-author" },
    createdAt: "2026-09-11T21:10:00.000Z",
  });
  graph = createWorkBranch(graph, {
    id: "fiction-workspace",
    kind: "workspace",
    fromRevisionId: "fiction-r0",
  });
  graph = createWorkBranch(graph, {
    id: "fiction-variant",
    kind: "variant",
    fromRevisionId: "fiction-r0",
  });

  const workspace = commitChangeSet({
    graph,
    manuscript: canonicalManuscript,
    branchId: "fiction-workspace",
    revisionId: "fiction-r-work",
    expectedHeadRevisionId: "fiction-r0",
    changeSet: createChangeSet({
      id: "fiction-cs-work",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "fiction-r0",
          nodeId: "fiction-paragraph",
          content: "The scene opens in silence before the door moves.",
        },
      ],
    }),
    author: { id: contributor.id },
    createdAt: "2026-09-11T21:11:00.000Z",
    provenanceRefs: [{ kind: "fiction.scene", id: "scene-12" }],
  });

  let proposal = createProposal({
    graph: workspace.graph,
    id: "fiction-proposal",
    projectId: "fiction-project",
    sourceBranchId: "fiction-workspace",
    sourceHeadRevisionId: "fiction-r-work",
    baseRevisionId: "fiction-r0",
    proposer: { id: contributor.id },
    createdAt: "2026-09-11T21:12:00.000Z",
    provenanceRefs: [{ kind: "fiction.scene", id: "scene-12" }],
    items: [
      {
        id: "fiction-item",
        sourceRevisionId: "fiction-r-work",
        changeIndex: 0,
      },
    ],
  });
  proposal = submitProposal(proposal, {
    submittedAt: "2026-09-11T21:13:00.000Z",
  });
  proposal = reviewProposalSelection(proposal, {
    itemIds: ["fiction-item"],
    decision: "accept",
    reviewer: { id: "fiction-author" },
    authorized: true,
    decisionIdPrefix: "fiction-accept",
    createdAt: "2026-09-11T21:14:00.000Z",
  });

  const integrated = integrateProposal({
    proposal,
    graph: workspace.graph,
    manuscript: canonicalManuscript,
    targetBranchId: "main",
    expectedHeadRevisionId: "fiction-r0",
    revisionId: "fiction-r-integrated",
    integrationId: "fiction-integration",
    integrator: { id: "fiction-editor" },
    createdAt: "2026-09-11T21:15:00.000Z",
    additionalParentIds: ["fiction-r-work"],
  });

  const variant = commitChangeSet({
    graph: integrated.commit.graph,
    manuscript: canonicalManuscript,
    branchId: "fiction-variant",
    revisionId: "fiction-r-variant",
    expectedHeadRevisionId: "fiction-r0",
    changeSet: createChangeSet({
      id: "fiction-cs-variant",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "fiction-r0",
          nodeId: "fiction-paragraph",
          content: "The alternate scene begins with the door already open.",
        },
      ],
    }),
    author: { id: "fiction-author" },
    createdAt: "2026-09-11T21:16:00.000Z",
    provenanceRefs: [{ kind: "fiction.scene", id: "scene-12" }],
  });

  return {
    authorization,
    canonicalManuscript,
    integrated,
    variant,
  };
}
