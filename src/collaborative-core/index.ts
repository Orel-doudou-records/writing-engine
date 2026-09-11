import { createHash } from "node:crypto";
import { z } from "zod";

const IdSchema = z.string().trim().min(1);

export const DomainEntityRefSchema = z.object({
  kind: z.string().trim().min(1),
  id: IdSchema,
});

export type DomainEntityRef = z.infer<typeof DomainEntityRefSchema>;

export const ContributorRefSchema = z.object({
  id: IdSchema,
});

export type ContributorRef = z.infer<typeof ContributorRefSchema>;

export const LiteraryNodeKindSchema = z.enum([
  "manuscript",
  "chapter",
  "section",
  "paragraph",
]);

export type LiteraryNodeKind = z.infer<typeof LiteraryNodeKindSchema>;

export const ContentVersionRefSchema = z.object({
  nodeId: IdSchema,
  version: z.number().int().positive(),
});

export type ContentVersionRef = z.infer<typeof ContentVersionRefSchema>;

export const ContentVersionSchema = z.object({
  nodeId: IdSchema,
  version: z.number().int().positive(),
  content: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  createdBy: ContributorRefSchema,
});

export type ContentVersion = z.infer<typeof ContentVersionSchema>;

export const NodeLineageSchema = z.object({
  derivedFrom: z.array(IdSchema),
  supersedes: z.array(IdSchema),
});

export type NodeLineage = z.infer<typeof NodeLineageSchema>;

export const TextRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine((range) => range.end > range.start, {
    message: "text range end must be greater than start",
  });

export type TextRange = z.infer<typeof TextRangeSchema>;

export const LiteraryScopeSchema = z.object({
  nodeId: IdSchema,
  range: TextRangeSchema.optional(),
});

export type LiteraryScope = z.infer<typeof LiteraryScopeSchema>;

export const LiteraryNodeSchema = z
  .object({
    id: IdSchema,
    kind: LiteraryNodeKindSchema,
    title: z.string().trim().min(1).optional(),
    parentId: IdSchema.optional(),
    childIds: z.array(IdSchema).default([]),
    contentRef: ContentVersionRefSchema.optional(),
    domainRefs: z.array(DomainEntityRefSchema).default([]),
    lineage: NodeLineageSchema.default({
      derivedFrom: [],
      supersedes: [],
    }),
    removed: z.boolean().default(false),
  })
  .superRefine((node, context) => {
    if (node.contentRef !== undefined && node.contentRef.nodeId !== node.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "content version reference must target the literary node",
        path: ["contentRef"],
      });
    }

    if (node.kind === "paragraph" && node.childIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "paragraph is the smallest persistent literary node",
        path: ["childIds"],
      });
    }
  });

export type LiteraryNode = z.infer<typeof LiteraryNodeSchema>;

const kindRank: Record<LiteraryNodeKind, number> = {
  manuscript: 0,
  chapter: 1,
  section: 2,
  paragraph: 3,
};

function canContain(parent: LiteraryNodeKind, child: LiteraryNodeKind): boolean {
  return kindRank[child] > kindRank[parent];
}

export const LiteraryManuscriptSchema = z
  .object({
    rootId: IdSchema,
    nodes: z.record(LiteraryNodeSchema),
  })
  .superRefine((manuscript, context) => {
    const root = manuscript.nodes[manuscript.rootId];
    if (root === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "manuscript root must exist",
        path: ["rootId"],
      });
      return;
    }

    if (root.kind !== "manuscript" || root.parentId !== undefined || root.removed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "root must be an active manuscript node without a parent",
        path: ["rootId"],
      });
    }

    for (const node of Object.values(manuscript.nodes)) {
      if (node.id !== manuscript.rootId && node.kind === "manuscript") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "only the root may have manuscript kind",
          path: ["nodes", node.id],
        });
      }

      if (new Set(node.childIds).size !== node.childIds.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "child ids must be unique",
          path: ["nodes", node.id, "childIds"],
        });
      }

      for (const childId of node.childIds) {
        const child = manuscript.nodes[childId];
        if (child === undefined || child.removed) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "active child reference must point to an active node",
            path: ["nodes", node.id, "childIds"],
          });
          continue;
        }

        if (child.parentId !== node.id) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "child parent reference must match its container",
            path: ["nodes", child.id, "parentId"],
          });
        }

        if (!canContain(node.kind, child.kind)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${node.kind} cannot contain ${child.kind}`,
            path: ["nodes", node.id, "childIds"],
          });
        }
      }

      if (!node.removed && node.id !== manuscript.rootId) {
        if (node.parentId === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "active non-root node requires a parent",
            path: ["nodes", node.id, "parentId"],
          });
          continue;
        }

        const parent = manuscript.nodes[node.parentId];
        if (
          parent === undefined ||
          parent.removed ||
          !parent.childIds.includes(node.id)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "active node must be contained by an active parent",
            path: ["nodes", node.id, "parentId"],
          });
        }
      }
    }
  });

export type LiteraryManuscript = z.infer<typeof LiteraryManuscriptSchema>;

function parseManuscript(manuscript: LiteraryManuscript): LiteraryManuscript {
  return LiteraryManuscriptSchema.parse(manuscript);
}

function requireActiveNode(
  manuscript: LiteraryManuscript,
  nodeId: string
): LiteraryNode {
  const node = manuscript.nodes[nodeId];
  if (node === undefined || node.removed) {
    throw new Error(`active literary node not found: ${nodeId}`);
  }
  return node;
}

function insertAt(values: string[], value: string, index?: number): string[] {
  if (index === undefined) return [...values, value];
  if (!Number.isInteger(index) || index < 0 || index > values.length) {
    throw new Error("child index is out of bounds");
  }
  return [...values.slice(0, index), value, ...values.slice(index)];
}

export type CreateLiteraryManuscriptInput = {
  id: string;
  title?: string;
  domainRefs?: DomainEntityRef[];
};

export function createLiteraryManuscript(
  input: CreateLiteraryManuscriptInput
): LiteraryManuscript {
  const root = LiteraryNodeSchema.parse({
    id: input.id,
    kind: "manuscript",
    title: input.title,
    childIds: [],
    domainRefs: input.domainRefs ?? [],
    lineage: { derivedFrom: [], supersedes: [] },
    removed: false,
  });

  return parseManuscript({
    rootId: root.id,
    nodes: { [root.id]: root },
  });
}

export type InsertLiteraryNodeInput = {
  id: string;
  kind: Exclude<LiteraryNodeKind, "manuscript">;
  parentId: string;
  title?: string;
  contentRef?: ContentVersionRef;
  domainRefs?: DomainEntityRef[];
  index?: number;
};

export function insertLiteraryNode(
  manuscript: LiteraryManuscript,
  input: InsertLiteraryNodeInput
): LiteraryManuscript {
  const current = parseManuscript(manuscript);
  if (current.nodes[input.id] !== undefined) {
    throw new Error(`literary node id already exists: ${input.id}`);
  }

  const parent = requireActiveNode(current, input.parentId);
  if (!canContain(parent.kind, input.kind)) {
    throw new Error(`${parent.kind} cannot contain ${input.kind}`);
  }

  const node = LiteraryNodeSchema.parse({
    id: input.id,
    kind: input.kind,
    parentId: input.parentId,
    title: input.title,
    childIds: [],
    contentRef: input.contentRef,
    domainRefs: input.domainRefs ?? [],
    lineage: { derivedFrom: [], supersedes: [] },
    removed: false,
  });

  return parseManuscript({
    ...current,
    nodes: {
      ...current.nodes,
      [parent.id]: {
        ...parent,
        childIds: insertAt(parent.childIds, node.id, input.index),
      },
      [node.id]: node,
    },
  });
}

export type CreateContentVersionInput = {
  nodeId: string;
  version: number;
  content: string;
  createdBy: ContributorRef;
  createdAt?: string;
};

export function createContentVersion(
  input: CreateContentVersionInput
): ContentVersion {
  return ContentVersionSchema.parse({
    ...input,
    contentHash: createHash("sha256").update(input.content).digest("hex"),
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export type RewriteLiteraryNodeInput = {
  nodeId: string;
  content: string;
  createdBy: ContributorRef;
  createdAt?: string;
};

export function rewriteLiteraryNode(
  manuscript: LiteraryManuscript,
  input: RewriteLiteraryNodeInput
): { manuscript: LiteraryManuscript; contentVersion: ContentVersion } {
  const current = parseManuscript(manuscript);
  const node = requireActiveNode(current, input.nodeId);
  const nextVersion = (node.contentRef?.version ?? 0) + 1;
  const contentVersion = createContentVersion({
    nodeId: node.id,
    version: nextVersion,
    content: input.content,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  });

  const nextManuscript = parseManuscript({
    ...current,
    nodes: {
      ...current.nodes,
      [node.id]: {
        ...node,
        contentRef: { nodeId: node.id, version: nextVersion },
      },
    },
  });

  return { manuscript: nextManuscript, contentVersion };
}

export type MoveLiteraryNodeInput = {
  nodeId: string;
  parentId: string;
  index?: number;
};

export function moveLiteraryNode(
  manuscript: LiteraryManuscript,
  input: MoveLiteraryNodeInput
): LiteraryManuscript {
  const current = parseManuscript(manuscript);
  const node = requireActiveNode(current, input.nodeId);
  if (node.id === current.rootId || node.parentId === undefined) {
    throw new Error("manuscript root cannot be moved");
  }

  const nextParent = requireActiveNode(current, input.parentId);
  if (!canContain(nextParent.kind, node.kind)) {
    throw new Error(`${nextParent.kind} cannot contain ${node.kind}`);
  }

  let cursor: LiteraryNode | undefined = nextParent;
  while (cursor !== undefined) {
    if (cursor.id === node.id) {
      throw new Error("literary node cannot be moved into its own subtree");
    }
    cursor = cursor.parentId ? current.nodes[cursor.parentId] : undefined;
  }

  const previousParent = requireActiveNode(current, node.parentId);
  const nodes = { ...current.nodes };
  nodes[previousParent.id] = {
    ...previousParent,
    childIds: previousParent.childIds.filter((id) => id !== node.id),
  };

  const destination = nodes[nextParent.id] ?? nextParent;
  nodes[nextParent.id] = {
    ...destination,
    childIds: insertAt(destination.childIds, node.id, input.index),
  };
  nodes[node.id] = { ...node, parentId: nextParent.id };

  return parseManuscript({ ...current, nodes });
}

export function removeLiteraryNode(
  manuscript: LiteraryManuscript,
  nodeId: string
): LiteraryManuscript {
  const current = parseManuscript(manuscript);
  const node = requireActiveNode(current, nodeId);
  if (node.id === current.rootId || node.parentId === undefined) {
    throw new Error("manuscript root cannot be removed");
  }
  if (node.childIds.length > 0) {
    throw new Error("CC1.1 logical removal is limited to leaf nodes");
  }

  const parent = requireActiveNode(current, node.parentId);
  return parseManuscript({
    ...current,
    nodes: {
      ...current.nodes,
      [parent.id]: {
        ...parent,
        childIds: parent.childIds.filter((id) => id !== node.id),
      },
      [node.id]: { ...node, removed: true },
    },
  });
}

export type SplitLiteraryNodeInput = {
  nodeId: string;
  replacements: Array<{
    id: string;
    kind: Exclude<LiteraryNodeKind, "manuscript">;
    title?: string;
    contentRef?: ContentVersionRef;
    domainRefs?: DomainEntityRef[];
  }>;
};

export function splitLiteraryNode(
  manuscript: LiteraryManuscript,
  input: SplitLiteraryNodeInput
): LiteraryManuscript {
  const current = parseManuscript(manuscript);
  const source = requireActiveNode(current, input.nodeId);
  if (source.id === current.rootId || source.parentId === undefined) {
    throw new Error("manuscript root cannot be split");
  }
  if (source.childIds.length > 0) {
    throw new Error("CC1.1 split is limited to leaf nodes");
  }
  if (input.replacements.length < 2) {
    throw new Error("split requires at least two replacement nodes");
  }

  const replacementIds = input.replacements.map((replacement) => replacement.id);
  if (new Set(replacementIds).size !== replacementIds.length) {
    throw new Error("split replacement ids must be unique");
  }

  for (const replacement of input.replacements) {
    if (current.nodes[replacement.id] !== undefined) {
      throw new Error(`literary node id already exists: ${replacement.id}`);
    }
    if (replacement.kind !== source.kind) {
      throw new Error("split replacements must keep the source literary kind");
    }
  }

  const parent = requireActiveNode(current, source.parentId);
  const sourceIndex = parent.childIds.indexOf(source.id);
  if (sourceIndex < 0) {
    throw new Error("source node is not present in its parent");
  }

  const replacementNodes = input.replacements.map((replacement) =>
    LiteraryNodeSchema.parse({
      ...replacement,
      parentId: parent.id,
      childIds: [],
      domainRefs: replacement.domainRefs ?? [],
      lineage: { derivedFrom: [source.id], supersedes: [] },
      removed: false,
    })
  );

  const nodes = {
    ...current.nodes,
    [source.id]: { ...source, removed: true },
    [parent.id]: {
      ...parent,
      childIds: [
        ...parent.childIds.slice(0, sourceIndex),
        ...replacementNodes.map((node) => node.id),
        ...parent.childIds.slice(sourceIndex + 1),
      ],
    },
  };

  for (const replacement of replacementNodes) {
    nodes[replacement.id] = replacement;
  }

  return parseManuscript({ ...current, nodes });
}

export type MergeLiteraryNodesInput = {
  nodeIds: string[];
  merged: {
    id: string;
    kind: Exclude<LiteraryNodeKind, "manuscript">;
    title?: string;
    contentRef?: ContentVersionRef;
    domainRefs?: DomainEntityRef[];
  };
};

export function mergeLiteraryNodes(
  manuscript: LiteraryManuscript,
  input: MergeLiteraryNodesInput
): LiteraryManuscript {
  const current = parseManuscript(manuscript);
  if (input.nodeIds.length < 2 || new Set(input.nodeIds).size !== input.nodeIds.length) {
    throw new Error("merge requires at least two distinct source nodes");
  }
  if (current.nodes[input.merged.id] !== undefined) {
    throw new Error(`literary node id already exists: ${input.merged.id}`);
  }

  const sources = input.nodeIds.map((nodeId) => requireActiveNode(current, nodeId));
  const parentId = sources[0]?.parentId;
  const kind = sources[0]?.kind;
  if (parentId === undefined || kind === undefined) {
    throw new Error("manuscript root cannot participate in merge");
  }

  if (
    sources.some(
      (source) =>
        source.id === current.rootId ||
        source.parentId !== parentId ||
        source.kind !== kind ||
        source.childIds.length > 0
    )
  ) {
    throw new Error("merge requires active sibling leaf nodes of the same kind");
  }
  if (input.merged.kind !== kind) {
    throw new Error("merged node must keep the source literary kind");
  }

  const parent = requireActiveNode(current, parentId);
  const orderedSources = sources
    .map((source) => ({ source, index: parent.childIds.indexOf(source.id) }))
    .sort((left, right) => left.index - right.index);

  if (orderedSources.some(({ index }) => index < 0)) {
    throw new Error("merge source is not present in its parent");
  }
  const firstIndex = orderedSources[0]!.index;
  if (orderedSources.some(({ index }, offset) => index !== firstIndex + offset)) {
    throw new Error("merge source nodes must be contiguous siblings");
  }

  const orderedIds = orderedSources.map(({ source }) => source.id);
  const mergedNode = LiteraryNodeSchema.parse({
    ...input.merged,
    parentId,
    childIds: [],
    domainRefs: input.merged.domainRefs ?? [],
    lineage: { derivedFrom: orderedIds, supersedes: [] },
    removed: false,
  });

  const sourceSet = new Set(orderedIds);
  const nodes = {
    ...current.nodes,
    [parent.id]: {
      ...parent,
      childIds: [
        ...parent.childIds.slice(0, firstIndex),
        mergedNode.id,
        ...parent.childIds.slice(firstIndex + orderedIds.length),
      ],
    },
    [mergedNode.id]: mergedNode,
  };

  for (const source of sources) {
    nodes[source.id] = { ...source, removed: true };
  }

  if (parent.childIds.filter((id) => sourceSet.has(id)).length !== orderedIds.length) {
    throw new Error("merge sources do not match parent structure");
  }

  return parseManuscript({ ...current, nodes });
}
