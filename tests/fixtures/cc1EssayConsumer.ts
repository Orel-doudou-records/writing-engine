import {
  ContributionPolicySchema,
  ContributorSchema,
  PermissionGrantSchema,
  RoleBindingSchema,
  commitDirectContribution,
  createChangeSet,
  createLiteraryManuscript,
  createRevisionGraph,
  createWorkBranch,
  insertLiteraryNode,
} from "../../src/index.js";

export function runEssayConsumerFixture() {
  const contributor = ContributorSchema.parse({
    id: "essay-author-agent",
    kind: "agent",
    displayName: "Essay author agent",
  });
  const roleBinding = RoleBindingSchema.parse({
    contributorId: contributor.id,
    roleIds: ["author"],
  });
  const policy = ContributionPolicySchema.parse({
    projectId: "essay-project",
    defaultMode: "propose",
    rules: [
      {
        id: "essay-author-direct",
        contributorId: contributor.id,
        roleId: "author",
        operation: "replace_content",
        mode: "direct",
      },
    ],
  });
  const permission = PermissionGrantSchema.parse({
    id: "essay-write",
    projectId: "essay-project",
    contributorId: contributor.id,
    operation: "replace_content",
  });

  let manuscript = createLiteraryManuscript({
    id: "essay-manuscript",
    title: "Essay",
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "essay-section",
    kind: "section",
    parentId: "essay-manuscript",
    title: "Argument",
  });
  manuscript = insertLiteraryNode(manuscript, {
    id: "essay-paragraph",
    kind: "paragraph",
    parentId: "essay-section",
    domainRefs: [{ kind: "claim", id: "claim-42" }],
  });

  let graph = createRevisionGraph({
    projectId: "essay-project",
    branchId: "main",
    revisionId: "essay-r0",
    author: { id: "human-author" },
    createdAt: "2026-09-11T21:00:00.000Z",
  });
  graph = createWorkBranch(graph, {
    id: "essay-draft",
    kind: "workspace",
    fromRevisionId: "essay-r0",
  });

  const result = commitDirectContribution({
    policy,
    contributor,
    roleBinding,
    permissionGrants: [permission],
    graph,
    manuscript,
    branchId: "essay-draft",
    revisionId: "essay-r1",
    expectedHeadRevisionId: "essay-r0",
    changeSet: createChangeSet({
      id: "essay-cs1",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "essay-r0",
          nodeId: "essay-paragraph",
          content: "A drafted argument grounded by an external claim reference.",
        },
      ],
    }),
    createdAt: "2026-09-11T21:01:00.000Z",
    operation: "replace_content",
    scope: { kind: "node", nodeId: "essay-paragraph" },
  });

  return {
    contributor,
    policy,
    manuscript: result.manuscript,
    graph: result.graph,
    revision: result.revision,
  };
}
