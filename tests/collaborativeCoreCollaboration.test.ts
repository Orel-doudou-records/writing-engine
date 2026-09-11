import { describe, expect, it } from "vitest";
import {
  AssignmentSchema,
  ContributionPolicySchema,
  ContributorSchema,
  EditorialRoleSchema,
  PermissionGrantSchema,
  RoleBindingSchema,
  TaskSchema,
  authorizeContribution,
  commitDirectContribution,
  createChangeSet,
  createLiteraryManuscript,
  createRevisionGraph,
  createWorkBranch,
  insertLiteraryNode,
  resolveContributionMode,
} from "../src/index.js";

const authorRole = EditorialRoleSchema.parse({ id: "author", label: "Auteur" });
const editorRole = EditorialRoleSchema.parse({ id: "editor", label: "Éditeur" });

const nodeScope = { kind: "node" as const, nodeId: "p1" };

function contributor(kind: "human" | "agent", id = "c1") {
  return ContributorSchema.parse({ id, kind, displayName: id });
}

function roleBinding(contributorId: string, roleIds = [authorRole.id, editorRole.id]) {
  return RoleBindingSchema.parse({ contributorId, roleIds });
}

function projectPermission(contributorId: string, operation = "replace_content" as const) {
  return PermissionGrantSchema.parse({
    id: `grant-${contributorId}-${operation}`,
    projectId: "project-1",
    contributorId,
    operation,
  });
}

describe("Collaborative Manuscript Core collaboration", () => {
  it("uses the same contributor contract for humans and agents without implicit authority", () => {
    const human = contributor("human", "human-1");
    const agent = contributor("agent", "agent-1");

    expect(human).toMatchObject({ kind: "human", displayName: "human-1" });
    expect(agent).toMatchObject({ kind: "agent", displayName: "agent-1" });

    const policy = ContributionPolicySchema.parse({
      projectId: "project-1",
      defaultMode: "propose",
      rules: [
        {
          id: "authors-direct",
          roleId: "author",
          operation: "replace_content",
          mode: "direct",
        },
      ],
    });

    const humanMode = resolveContributionMode({
      policy,
      contributor: human,
      roleBinding: roleBinding(human.id, ["author"]),
      projectId: "project-1",
      operation: "replace_content",
      scope: nodeScope,
    });
    const agentMode = resolveContributionMode({
      policy,
      contributor: agent,
      roleBinding: roleBinding(agent.id, ["author"]),
      projectId: "project-1",
      operation: "replace_content",
      scope: nodeScope,
    });

    expect(humanMode).toBe("direct");
    expect(agentMode).toBe("direct");

    expect(
      authorizeContribution({
        policy,
        contributor: human,
        roleBinding: roleBinding(human.id, ["author"]),
        permissionGrants: [],
        projectId: "project-1",
        operation: "replace_content",
        scope: nodeScope,
      })
    ).toEqual({ authorized: false, reason: "permission_required" });
  });

  it("keeps roles, permissions and assignments distinct while allowing multiple roles", () => {
    const worker = contributor("human", "worker-1");
    const binding = roleBinding(worker.id);
    const grant = projectPermission(worker.id);
    const assignment = AssignmentSchema.parse({
      contributorId: worker.id,
      scope: { kind: "node", nodeId: "chapter-1" },
    });

    expect(binding.roleIds).toEqual(["author", "editor"]);
    expect(grant.operation).toBe("replace_content");
    expect(assignment.scope).toEqual({ kind: "node", nodeId: "chapter-1" });
  });

  it("models one primary task assignee with optional reviewers and collaborators", () => {
    const task = TaskSchema.parse({
      id: "task-1",
      projectId: "project-1",
      title: "Réviser le chapitre 1",
      status: "in_progress",
      assignee: {
        contributorId: "corrector-1",
        scope: { kind: "node", nodeId: "chapter-1" },
      },
      reviewers: [
        {
          contributorId: "editor-1",
          scope: { kind: "node", nodeId: "chapter-1" },
        },
      ],
      collaborators: [],
      workspaceBranchId: "work-task-1",
    });

    expect(task.assignee.contributorId).toBe("corrector-1");
    expect(task.reviewers.map((assignment) => assignment.contributorId)).toEqual([
      "editor-1",
    ]);
    expect(task.status).toBe("in_progress");
  });

  it("resolves direct/propose by ordered contributor, role, operation and scope rules", () => {
    const editor = contributor("human", "editor-1");
    const binding = roleBinding(editor.id, ["editor"]);
    const policy = ContributionPolicySchema.parse({
      projectId: "project-1",
      defaultMode: "propose",
      rules: [
        {
          id: "editor-paragraph-rewrite",
          roleId: "editor",
          operation: "replace_content",
          scope: { kind: "node", nodeId: "p1" },
          mode: "direct",
        },
        {
          id: "editor-structural-proposal",
          roleId: "editor",
          operation: "move_node",
          mode: "propose",
        },
      ],
    });

    expect(
      resolveContributionMode({
        policy,
        contributor: editor,
        roleBinding: binding,
        projectId: "project-1",
        operation: "replace_content",
        scope: { kind: "node", nodeId: "p1" },
      })
    ).toBe("direct");

    expect(
      resolveContributionMode({
        policy,
        contributor: editor,
        roleBinding: binding,
        projectId: "project-1",
        operation: "move_node",
        scope: { kind: "node", nodeId: "p1" },
      })
    ).toBe("propose");
  });

  it("allows contributor-specific policy and permission differences for the same role", () => {
    const editorA = contributor("human", "editor-a");
    const editorB = contributor("human", "editor-b");
    const policy = ContributionPolicySchema.parse({
      projectId: "project-1",
      defaultMode: "propose",
      rules: [
        {
          id: "editor-a-direct",
          contributorId: "editor-a",
          roleId: "editor",
          operation: "replace_content",
          mode: "direct",
        },
      ],
    });

    const context = {
      policy,
      projectId: "project-1",
      operation: "replace_content" as const,
      scope: nodeScope,
    };

    expect(
      authorizeContribution({
        ...context,
        contributor: editorA,
        roleBinding: roleBinding(editorA.id, ["editor"]),
        permissionGrants: [projectPermission(editorA.id)],
      })
    ).toEqual({ authorized: true, mode: "direct" });

    expect(
      authorizeContribution({
        ...context,
        contributor: editorB,
        roleBinding: roleBinding(editorB.id, ["editor"]),
        permissionGrants: [],
      })
    ).toEqual({ authorized: false, reason: "permission_required" });
  });

  it("commits direct work only in an authorized non-canonical workspace", () => {
    const author = contributor("human", "author-1");
    const binding = roleBinding(author.id, ["author"]);
    const policy = ContributionPolicySchema.parse({
      projectId: "project-1",
      defaultMode: "propose",
      rules: [
        {
          id: "author-draft-direct",
          contributorId: author.id,
          operation: "replace_content",
          scope: nodeScope,
          mode: "direct",
        },
      ],
    });

    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, {
      id: "p1",
      kind: "paragraph",
      parentId: "m1",
    });

    let graph = createRevisionGraph({
      projectId: "project-1",
      branchId: "main",
      revisionId: "r0",
      author: { id: "author-1" },
      createdAt: "2026-09-11T19:00:00.000Z",
    });
    graph = createWorkBranch(graph, {
      id: "work-1",
      kind: "workspace",
      fromRevisionId: "r0",
    });

    const changeSet = createChangeSet({
      id: "cs-1",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "r0",
          nodeId: "p1",
          content: "Draft text",
        },
      ],
    });

    const result = commitDirectContribution({
      policy,
      contributor: author,
      roleBinding: binding,
      permissionGrants: [projectPermission(author.id)],
      graph,
      manuscript,
      branchId: "work-1",
      revisionId: "r1",
      expectedHeadRevisionId: "r0",
      changeSet,
      createdAt: "2026-09-11T19:10:00.000Z",
      operation: "replace_content",
      scope: nodeScope,
    });

    expect(result.graph.branches["work-1"]?.headRevisionId).toBe("r1");
    expect(result.graph.branches.main?.headRevisionId).toBe("r0");
    expect(result.revision.author.id).toBe(author.id);
  });

  it("does not turn propose mode into a canonical or direct revision", () => {
    const corrector = contributor("agent", "corrector-1");
    const policy = ContributionPolicySchema.parse({
      projectId: "project-1",
      defaultMode: "propose",
      rules: [],
    });

    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, {
      id: "p1",
      kind: "paragraph",
      parentId: "m1",
    });
    const graph = createRevisionGraph({
      projectId: "project-1",
      branchId: "main",
      revisionId: "r0",
      author: { id: "author-1" },
      createdAt: "2026-09-11T19:00:00.000Z",
    });

    const decision = authorizeContribution({
      policy,
      contributor: corrector,
      roleBinding: roleBinding(corrector.id, ["editor"]),
      permissionGrants: [projectPermission(corrector.id)],
      projectId: "project-1",
      operation: "replace_content",
      scope: nodeScope,
    });

    expect(decision).toEqual({ authorized: true, mode: "propose" });
    expect(graph.branches.main?.headRevisionId).toBe("r0");

    expect(() =>
      commitDirectContribution({
        policy,
        contributor: corrector,
        roleBinding: roleBinding(corrector.id, ["editor"]),
        permissionGrants: [projectPermission(corrector.id)],
        graph,
        manuscript,
        branchId: "main",
        revisionId: "r1",
        expectedHeadRevisionId: "r0",
        changeSet: createChangeSet({
          id: "cs-propose",
          changes: [
            {
              kind: "replace_content",
              baseRevisionId: "r0",
              nodeId: "p1",
              content: "Suggested text",
            },
          ],
        }),
        createdAt: "2026-09-11T19:20:00.000Z",
        operation: "replace_content",
        scope: nodeScope,
      })
    ).toThrow(/requires proposal/);
  });
});
