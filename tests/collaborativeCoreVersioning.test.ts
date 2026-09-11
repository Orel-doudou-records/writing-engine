import { describe, expect, it } from "vitest";
import {
  ChangeSchema,
  createChangeSet,
  createLiteraryManuscript,
  createRevisionGraph,
  createWorkBranch,
  commitChangeSet,
  getRevisionAncestors,
  insertLiteraryNode,
  restoreRevision,
} from "../src/index.js";

function baseManuscript() {
  let manuscript = createLiteraryManuscript({ id: "m1", title: "Book" });
  manuscript = insertLiteraryNode(manuscript, {
    id: "p1",
    kind: "paragraph",
    parentId: "m1",
  });
  return manuscript;
}

function baseGraph() {
  return createRevisionGraph({
    projectId: "project-1",
    branchId: "main",
    revisionId: "r0",
    author: { id: "author-1" },
    createdAt: "2026-09-11T19:00:00.000Z",
  });
}

describe("Collaborative Manuscript Core versioning", () => {
  it("supports the complete semantic change vocabulary", () => {
    const base = { baseRevisionId: "r0" };
    const changes = [
      { kind: "replace_content", ...base, nodeId: "p1", content: "New text" },
      {
        kind: "insert_node",
        ...base,
        node: { id: "p2", kind: "paragraph", parentId: "m1" },
      },
      { kind: "remove_node", ...base, nodeId: "p1" },
      { kind: "move_node", ...base, nodeId: "p1", parentId: "c2" },
      {
        kind: "split_node",
        ...base,
        nodeId: "p1",
        replacements: [
          { id: "p1a", kind: "paragraph" },
          { id: "p1b", kind: "paragraph" },
        ],
      },
      {
        kind: "merge_nodes",
        ...base,
        nodeIds: ["p1", "p2"],
        merged: { id: "p3", kind: "paragraph" },
      },
      {
        kind: "update_node_metadata",
        ...base,
        nodeId: "p1",
        metadata: { title: "Opening", domainRefs: [{ kind: "claim", id: "c1" }] },
      },
    ] as const;

    for (const change of changes) {
      expect(ChangeSchema.parse(change).kind).toBe(change.kind);
    }
  });

  it("keeps workspace and variant heads independent while sharing ancestry", () => {
    let graph = baseGraph();
    graph = createWorkBranch(graph, {
      id: "rewrite",
      kind: "workspace",
      fromRevisionId: "r0",
    });
    graph = createWorkBranch(graph, {
      id: "alternate-ending",
      kind: "variant",
      fromRevisionId: "r0",
    });

    const changeSet = createChangeSet({
      id: "cs1",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "r0",
          nodeId: "p1",
          content: "Workspace text",
        },
      ],
    });

    const result = commitChangeSet({
      graph,
      manuscript: baseManuscript(),
      branchId: "rewrite",
      revisionId: "r1",
      expectedHeadRevisionId: "r0",
      changeSet,
      author: { id: "editor-1" },
      createdAt: "2026-09-11T20:00:00.000Z",
    });

    expect(result.graph.branches.rewrite?.headRevisionId).toBe("r1");
    expect(result.graph.branches["alternate-ending"]?.headRevisionId).toBe("r0");
    expect(result.graph.branches.main?.headRevisionId).toBe("r0");
    expect(result.graph.revisions.r0).toEqual(graph.revisions.r0);
    expect(result.revision.parentIds).toEqual(["r0"]);
    expect(getRevisionAncestors(result.graph, "r1")).toEqual(["r0"]);
  });

  it("rejects a stale branch head or change with the wrong expected base", () => {
    const graph = createWorkBranch(baseGraph(), {
      id: "rewrite",
      kind: "workspace",
      fromRevisionId: "r0",
    });
    const manuscript = baseManuscript();

    expect(() =>
      commitChangeSet({
        graph,
        manuscript,
        branchId: "rewrite",
        revisionId: "r1",
        expectedHeadRevisionId: "other",
        changeSet: createChangeSet({
          id: "cs-stale-head",
          changes: [],
        }),
        author: { id: "editor-1" },
        createdAt: "2026-09-11T20:00:00.000Z",
      })
    ).toThrow();

    expect(() =>
      commitChangeSet({
        graph,
        manuscript,
        branchId: "rewrite",
        revisionId: "r1",
        expectedHeadRevisionId: "r0",
        changeSet: createChangeSet({
          id: "cs-stale-change",
          changes: [
            {
              kind: "remove_node",
              baseRevisionId: "old-revision",
              nodeId: "p1",
            },
          ],
        }),
        author: { id: "editor-1" },
        createdAt: "2026-09-11T20:00:00.000Z",
      })
    ).toThrow();
  });

  it("restores by creating a new revision instead of rewinding history", () => {
    let graph = createWorkBranch(baseGraph(), {
      id: "rewrite",
      kind: "workspace",
      fromRevisionId: "r0",
    });
    let manuscript = baseManuscript();

    const first = commitChangeSet({
      graph,
      manuscript,
      branchId: "rewrite",
      revisionId: "r1",
      expectedHeadRevisionId: "r0",
      changeSet: createChangeSet({
        id: "cs1",
        changes: [
          {
            kind: "replace_content",
            baseRevisionId: "r0",
            nodeId: "p1",
            content: "Changed",
          },
        ],
      }),
      author: { id: "author-1" },
      createdAt: "2026-09-11T20:00:00.000Z",
    });
    graph = first.graph;
    manuscript = first.manuscript;

    const restored = restoreRevision({
      graph,
      manuscript,
      branchId: "rewrite",
      revisionId: "r2",
      expectedHeadRevisionId: "r1",
      restoresRevisionId: "r0",
      changeSet: createChangeSet({
        id: "cs2",
        changes: [
          {
            kind: "replace_content",
            baseRevisionId: "r1",
            nodeId: "p1",
            expectedContentVersion: { nodeId: "p1", version: 1 },
            content: "Original again",
          },
        ],
      }),
      author: { id: "author-1" },
      createdAt: "2026-09-11T21:00:00.000Z",
    });

    expect(restored.graph.branches.rewrite?.headRevisionId).toBe("r2");
    expect(restored.graph.revisions.r1).toEqual(first.graph.revisions.r1);
    expect(restored.revision.parentIds).toEqual(["r1"]);
    expect(restored.revision.restoresRevisionId).toBe("r0");
    expect(getRevisionAncestors(restored.graph, "r2")).toEqual(["r1", "r0"]);
  });

  it("creates immutable ChangeSets and deterministic results from fixed inputs", () => {
    const changeSet = createChangeSet({
      id: "cs1",
      changes: [
        {
          kind: "replace_content",
          baseRevisionId: "r0",
          nodeId: "p1",
          content: "Same text",
        },
      ],
    });

    expect(Object.isFrozen(changeSet)).toBe(true);
    expect(Object.isFrozen(changeSet.changes)).toBe(true);

    const graph = createWorkBranch(baseGraph(), {
      id: "rewrite",
      kind: "workspace",
      fromRevisionId: "r0",
    });
    const input = {
      graph,
      manuscript: baseManuscript(),
      branchId: "rewrite",
      revisionId: "r1",
      expectedHeadRevisionId: "r0",
      changeSet,
      author: { id: "editor-1" },
      createdAt: "2026-09-11T20:00:00.000Z",
    } as const;

    const a = commitChangeSet(input);
    const b = commitChangeSet(input);

    expect(a.manuscript).toEqual(b.manuscript);
    expect(a.revision).toEqual(b.revision);
  });
});
