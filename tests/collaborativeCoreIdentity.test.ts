import { describe, expect, it } from "vitest";
import {
  ContentVersionSchema,
  DomainEntityRefSchema,
  LiteraryScopeSchema,
  createContentVersion,
  createLiteraryManuscript,
  insertLiteraryNode,
  mergeLiteraryNodes,
  moveLiteraryNode,
  removeLiteraryNode,
  rewriteLiteraryNode,
  splitLiteraryNode,
} from "../src/index.js";

describe("Collaborative Manuscript Core identity", () => {
  it("keeps typed hierarchy flexible while preserving literary levels", () => {
    let manuscript = createLiteraryManuscript({ id: "m1", title: "Book" });

    manuscript = insertLiteraryNode(manuscript, {
      id: "c1",
      kind: "chapter",
      parentId: "m1",
      title: "Chapter 1",
    });
    manuscript = insertLiteraryNode(manuscript, {
      id: "p1",
      kind: "paragraph",
      parentId: "c1",
    });

    expect(manuscript.nodes.c1?.childIds).toEqual(["p1"]);
    expect(manuscript.nodes.p1?.kind).toBe("paragraph");
    expect(() =>
      insertLiteraryNode(manuscript, {
        id: "s1",
        kind: "section",
        parentId: "p1",
      })
    ).toThrow();
  });

  it("keeps domain references opaque and validates fine-grained scopes", () => {
    expect(DomainEntityRefSchema.parse({ kind: "claim", id: "claim-1" })).toEqual({
      kind: "claim",
      id: "claim-1",
    });
    expect(LiteraryScopeSchema.parse({ nodeId: "p1", range: { start: 4, end: 9 } })).toEqual({
      nodeId: "p1",
      range: { start: 4, end: 9 },
    });
    expect(() => LiteraryScopeSchema.parse({ nodeId: "p1", range: { start: 9, end: 4 } })).toThrow();
  });

  it("rewrites content without changing node identity or historical versions", () => {
    const v1 = createContentVersion({
      nodeId: "p1",
      version: 1,
      content: "First draft",
      createdBy: { id: "author-1" },
      createdAt: "2026-09-11T10:00:00.000Z",
    });

    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, {
      id: "p1",
      kind: "paragraph",
      parentId: "m1",
      contentRef: { nodeId: "p1", version: 1 },
    });

    const result = rewriteLiteraryNode(manuscript, {
      nodeId: "p1",
      content: "Second draft",
      createdBy: { id: "author-1" },
      createdAt: "2026-09-11T11:00:00.000Z",
    });

    expect(result.manuscript.nodes.p1?.id).toBe("p1");
    expect(result.contentVersion.version).toBe(2);
    expect(result.manuscript.nodes.p1?.contentRef).toEqual({ nodeId: "p1", version: 2 });
    expect(v1.content).toBe("First draft");
    expect(ContentVersionSchema.parse(v1)).toEqual(v1);
  });

  it("moves a node while keeping its identity", () => {
    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "c1", kind: "chapter", parentId: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "c2", kind: "chapter", parentId: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "p1", kind: "paragraph", parentId: "c1" });

    const moved = moveLiteraryNode(manuscript, { nodeId: "p1", parentId: "c2" });

    expect(moved.nodes.p1?.id).toBe("p1");
    expect(moved.nodes.p1?.parentId).toBe("c2");
    expect(moved.nodes.c1?.childIds).toEqual([]);
    expect(moved.nodes.c2?.childIds).toEqual(["p1"]);
  });

  it("splits a leaf into new identities with explicit lineage", () => {
    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "p1", kind: "paragraph", parentId: "m1" });

    const split = splitLiteraryNode(manuscript, {
      nodeId: "p1",
      replacements: [
        { id: "p1a", kind: "paragraph" },
        { id: "p1b", kind: "paragraph" },
      ],
    });

    expect(split.nodes.m1?.childIds).toEqual(["p1a", "p1b"]);
    expect(split.nodes.p1?.removed).toBe(true);
    expect(split.nodes.p1a?.lineage.derivedFrom).toEqual(["p1"]);
    expect(split.nodes.p1b?.lineage.derivedFrom).toEqual(["p1"]);
  });

  it("merges sibling leaves into a new identity with all origins", () => {
    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "p1", kind: "paragraph", parentId: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "p2", kind: "paragraph", parentId: "m1" });

    const merged = mergeLiteraryNodes(manuscript, {
      nodeIds: ["p1", "p2"],
      merged: { id: "p3", kind: "paragraph" },
    });

    expect(merged.nodes.m1?.childIds).toEqual(["p3"]);
    expect(merged.nodes.p3?.lineage.derivedFrom).toEqual(["p1", "p2"]);
    expect(merged.nodes.p1?.removed).toBe(true);
    expect(merged.nodes.p2?.removed).toBe(true);
  });

  it("logically removes a node while keeping historical identity addressable", () => {
    let manuscript = createLiteraryManuscript({ id: "m1" });
    manuscript = insertLiteraryNode(manuscript, { id: "p1", kind: "paragraph", parentId: "m1" });

    const removed = removeLiteraryNode(manuscript, "p1");

    expect(removed.nodes.m1?.childIds).toEqual([]);
    expect(removed.nodes.p1).toEqual(expect.objectContaining({ id: "p1", removed: true }));
  });
});
