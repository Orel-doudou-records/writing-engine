import { z } from "zod";
import {
  ContentVersionRefSchema,
  ContributorRefSchema,
  DomainEntityRefSchema,
  LiteraryManuscriptSchema,
  insertLiteraryNode,
  mergeLiteraryNodes,
  moveLiteraryNode,
  removeLiteraryNode,
  rewriteLiteraryNode,
  splitLiteraryNode,
  type ContentVersion,
  type ContributorRef,
  type DomainEntityRef,
  type LiteraryManuscript,
} from "./index.js";

const IdSchema = z.string().trim().min(1);
const NonRootLiteraryNodeKindSchema = z.enum(["chapter", "section", "paragraph"]);

const ChangeBaseSchema = z.object({
  baseRevisionId: IdSchema,
});

const ChangeNodeInputSchema = z.object({
  id: IdSchema,
  kind: NonRootLiteraryNodeKindSchema,
  parentId: IdSchema,
  title: z.string().trim().min(1).optional(),
  contentRef: ContentVersionRefSchema.optional(),
  domainRefs: z.array(DomainEntityRefSchema).optional(),
  index: z.number().int().nonnegative().optional(),
});

const ReplacementNodeInputSchema = z.object({
  id: IdSchema,
  kind: NonRootLiteraryNodeKindSchema,
  title: z.string().trim().min(1).optional(),
  contentRef: ContentVersionRefSchema.optional(),
  domainRefs: z.array(DomainEntityRefSchema).optional(),
});

export const ChangeSchema = z.discriminatedUnion("kind", [
  ChangeBaseSchema.extend({
    kind: z.literal("replace_content"),
    nodeId: IdSchema,
    expectedContentVersion: ContentVersionRefSchema.optional(),
    content: z.string(),
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("insert_node"),
    node: ChangeNodeInputSchema,
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("remove_node"),
    nodeId: IdSchema,
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("move_node"),
    nodeId: IdSchema,
    parentId: IdSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("split_node"),
    nodeId: IdSchema,
    replacements: z.array(ReplacementNodeInputSchema).min(2),
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("merge_nodes"),
    nodeIds: z.array(IdSchema).min(2),
    merged: ReplacementNodeInputSchema,
  }),
  ChangeBaseSchema.extend({
    kind: z.literal("update_node_metadata"),
    nodeId: IdSchema,
    metadata: z
      .object({
        title: z.string().trim().min(1).nullable().optional(),
        domainRefs: z.array(DomainEntityRefSchema).optional(),
      })
      .refine(
        (metadata) =>
          metadata.title !== undefined || metadata.domainRefs !== undefined,
        { message: "metadata change requires at least one field" }
      ),
  }),
]);

export type Change = z.infer<typeof ChangeSchema>;

export const ChangeSetSchema = z.object({
  id: IdSchema,
  changes: z.array(ChangeSchema),
});

export type ChangeSet = z.infer<typeof ChangeSetSchema>;

export const BranchKindSchema = z.enum(["workspace", "variant"]);
export type BranchKind = z.infer<typeof BranchKindSchema>;

export const RevisionSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  branchId: IdSchema,
  parentIds: z.array(IdSchema),
  changeSetId: IdSchema,
  author: ContributorRefSchema,
  createdAt: z.string().datetime(),
  message: z.string().trim().min(1).optional(),
  provenanceRefs: z.array(DomainEntityRefSchema).default([]),
  restoresRevisionId: IdSchema.optional(),
});

export type Revision = z.infer<typeof RevisionSchema>;

export const WorkBranchSchema = z.object({
  id: IdSchema,
  kind: BranchKindSchema,
  headRevisionId: IdSchema,
  canonical: z.boolean().default(false),
});

export type WorkBranch = z.infer<typeof WorkBranchSchema>;

export const RevisionGraphSchema = z
  .object({
    projectId: IdSchema,
    canonicalBranchId: IdSchema,
    revisions: z.record(RevisionSchema),
    changeSets: z.record(ChangeSetSchema),
    branches: z.record(WorkBranchSchema),
  })
  .superRefine((graph, context) => {
    const canonical = graph.branches[graph.canonicalBranchId];
    if (canonical === undefined || !canonical.canonical) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "canonical branch must exist and be marked canonical",
        path: ["canonicalBranchId"],
      });
    }

    for (const revision of Object.values(graph.revisions)) {
      if (revision.projectId !== graph.projectId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "revision project must match graph project",
          path: ["revisions", revision.id, "projectId"],
        });
      }
      if (graph.changeSets[revision.changeSetId] === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "revision must reference an existing ChangeSet",
          path: ["revisions", revision.id, "changeSetId"],
        });
      }
      for (const parentId of revision.parentIds) {
        if (graph.revisions[parentId] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "revision parent must exist",
            path: ["revisions", revision.id, "parentIds"],
          });
        }
      }
      if (
        revision.restoresRevisionId !== undefined &&
        graph.revisions[revision.restoresRevisionId] === undefined
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "restored revision must exist",
          path: ["revisions", revision.id, "restoresRevisionId"],
        });
      }
    }

    for (const branch of Object.values(graph.branches)) {
      if (graph.revisions[branch.headRevisionId] === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "branch head must reference an existing revision",
          path: ["branches", branch.id, "headRevisionId"],
        });
      }
    }
  });

export type RevisionGraph = z.infer<typeof RevisionGraphSchema>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function freezeChangeSet(changeSet: ChangeSet): ChangeSet {
  return deepFreeze(changeSet) as ChangeSet;
}

function freezeGraph(graph: RevisionGraph): RevisionGraph {
  return deepFreeze(graph) as RevisionGraph;
}

export function createChangeSet(input: z.input<typeof ChangeSetSchema>): ChangeSet {
  return freezeChangeSet(ChangeSetSchema.parse(input));
}

export type CreateRevisionGraphInput = {
  projectId: string;
  branchId: string;
  revisionId: string;
  author: ContributorRef;
  createdAt: string;
};

export function createRevisionGraph(input: CreateRevisionGraphInput): RevisionGraph {
  const initialChangeSet = createChangeSet({
    id: `initial:${input.revisionId}`,
    changes: [],
  });
  const initialRevision = RevisionSchema.parse({
    id: input.revisionId,
    projectId: input.projectId,
    branchId: input.branchId,
    parentIds: [],
    changeSetId: initialChangeSet.id,
    author: input.author,
    createdAt: input.createdAt,
    provenanceRefs: [],
  });
  const branch = WorkBranchSchema.parse({
    id: input.branchId,
    kind: "workspace",
    headRevisionId: input.revisionId,
    canonical: true,
  });

  return freezeGraph(
    RevisionGraphSchema.parse({
      projectId: input.projectId,
      canonicalBranchId: branch.id,
      revisions: { [initialRevision.id]: initialRevision },
      changeSets: { [initialChangeSet.id]: initialChangeSet },
      branches: { [branch.id]: branch },
    })
  );
}

export type CreateWorkBranchInput = {
  id: string;
  kind: BranchKind;
  fromRevisionId: string;
};

export function createWorkBranch(
  graph: RevisionGraph,
  input: CreateWorkBranchInput
): RevisionGraph {
  const current = RevisionGraphSchema.parse(graph);
  if (current.branches[input.id] !== undefined) {
    throw new Error(`branch id already exists: ${input.id}`);
  }
  if (current.revisions[input.fromRevisionId] === undefined) {
    throw new Error(`revision not found: ${input.fromRevisionId}`);
  }

  const branch = WorkBranchSchema.parse({
    id: input.id,
    kind: input.kind,
    headRevisionId: input.fromRevisionId,
    canonical: false,
  });

  return freezeGraph(
    RevisionGraphSchema.parse({
      ...current,
      branches: { ...current.branches, [branch.id]: branch },
    })
  );
}

function equalContentRef(
  actual: { nodeId: string; version: number } | undefined,
  expected: { nodeId: string; version: number }
): boolean {
  return (
    actual !== undefined &&
    actual.nodeId === expected.nodeId &&
    actual.version === expected.version
  );
}

function applyMetadataChange(
  manuscript: LiteraryManuscript,
  change: Extract<Change, { kind: "update_node_metadata" }>
): LiteraryManuscript {
  const current = LiteraryManuscriptSchema.parse(manuscript);
  const node = current.nodes[change.nodeId];
  if (node === undefined || node.removed) {
    throw new Error(`active literary node not found: ${change.nodeId}`);
  }

  const nextNode = {
    ...node,
    ...(change.metadata.title === undefined
      ? {}
      : change.metadata.title === null
        ? { title: undefined }
        : { title: change.metadata.title }),
    ...(change.metadata.domainRefs === undefined
      ? {}
      : { domainRefs: change.metadata.domainRefs }),
  };

  return LiteraryManuscriptSchema.parse({
    ...current,
    nodes: { ...current.nodes, [node.id]: nextNode },
  });
}

function applyChange(
  manuscript: LiteraryManuscript,
  change: Change,
  author: ContributorRef,
  createdAt: string
): { manuscript: LiteraryManuscript; contentVersion?: ContentVersion } {
  switch (change.kind) {
    case "replace_content": {
      const current = LiteraryManuscriptSchema.parse(manuscript);
      const node = current.nodes[change.nodeId];
      if (node === undefined || node.removed) {
        throw new Error(`active literary node not found: ${change.nodeId}`);
      }
      if (
        change.expectedContentVersion !== undefined &&
        !equalContentRef(node.contentRef, change.expectedContentVersion)
      ) {
        throw new Error(`content version mismatch for node: ${change.nodeId}`);
      }
      const rewritten = rewriteLiteraryNode(current, {
        nodeId: change.nodeId,
        content: change.content,
        createdBy: author,
        createdAt,
      });
      return rewritten;
    }
    case "insert_node":
      return {
        manuscript: insertLiteraryNode(manuscript, change.node),
      };
    case "remove_node":
      return {
        manuscript: removeLiteraryNode(manuscript, change.nodeId),
      };
    case "move_node":
      return {
        manuscript: moveLiteraryNode(manuscript, {
          nodeId: change.nodeId,
          parentId: change.parentId,
          index: change.index,
        }),
      };
    case "split_node":
      return {
        manuscript: splitLiteraryNode(manuscript, {
          nodeId: change.nodeId,
          replacements: change.replacements,
        }),
      };
    case "merge_nodes":
      return {
        manuscript: mergeLiteraryNodes(manuscript, {
          nodeIds: change.nodeIds,
          merged: change.merged,
        }),
      };
    case "update_node_metadata":
      return { manuscript: applyMetadataChange(manuscript, change) };
  }
}

function applyChangeSet(
  manuscript: LiteraryManuscript,
  changeSet: ChangeSet,
  expectedBaseRevisionId: string,
  author: ContributorRef,
  createdAt: string
): { manuscript: LiteraryManuscript; contentVersions: ContentVersion[] } {
  let current = LiteraryManuscriptSchema.parse(manuscript);
  const contentVersions: ContentVersion[] = [];

  for (const change of changeSet.changes) {
    if (change.baseRevisionId !== expectedBaseRevisionId) {
      throw new Error(
        `change base revision mismatch: expected ${expectedBaseRevisionId}, got ${change.baseRevisionId}`
      );
    }
    const applied = applyChange(current, change, author, createdAt);
    current = applied.manuscript;
    if (applied.contentVersion !== undefined) {
      contentVersions.push(applied.contentVersion);
    }
  }

  return { manuscript: current, contentVersions };
}

export type CommitChangeSetInput = {
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  branchId: string;
  revisionId: string;
  expectedHeadRevisionId: string;
  changeSet: ChangeSet;
  author: ContributorRef;
  createdAt: string;
  message?: string;
  provenanceRefs?: DomainEntityRef[];
  additionalParentIds?: string[];
  restoresRevisionId?: string;
};

export type CommitChangeSetResult = {
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  revision: Revision;
  contentVersions: ContentVersion[];
};

export function commitChangeSet(
  input: CommitChangeSetInput
): CommitChangeSetResult {
  const graph = RevisionGraphSchema.parse(input.graph);
  const branch = graph.branches[input.branchId];
  if (branch === undefined) {
    throw new Error(`branch not found: ${input.branchId}`);
  }
  if (branch.headRevisionId !== input.expectedHeadRevisionId) {
    throw new Error(
      `branch head mismatch: expected ${input.expectedHeadRevisionId}, got ${branch.headRevisionId}`
    );
  }
  if (graph.revisions[input.revisionId] !== undefined) {
    throw new Error(`revision id already exists: ${input.revisionId}`);
  }
  if (graph.changeSets[input.changeSet.id] !== undefined) {
    throw new Error(`ChangeSet id already exists: ${input.changeSet.id}`);
  }
  if (
    input.restoresRevisionId !== undefined &&
    graph.revisions[input.restoresRevisionId] === undefined
  ) {
    throw new Error(`revision not found: ${input.restoresRevisionId}`);
  }

  const changeSet = createChangeSet(input.changeSet);
  const applied = applyChangeSet(
    input.manuscript,
    changeSet,
    branch.headRevisionId,
    input.author,
    input.createdAt
  );

  const additionalParentIds = input.additionalParentIds ?? [];
  for (const parentId of additionalParentIds) {
    if (graph.revisions[parentId] === undefined) {
      throw new Error(`revision not found: ${parentId}`);
    }
  }
  const parentIds = [
    branch.headRevisionId,
    ...additionalParentIds.filter((id) => id !== branch.headRevisionId),
  ];
  if (new Set(parentIds).size !== parentIds.length) {
    throw new Error("revision parents must be unique");
  }

  const revision = RevisionSchema.parse({
    id: input.revisionId,
    projectId: graph.projectId,
    branchId: branch.id,
    parentIds,
    changeSetId: changeSet.id,
    author: input.author,
    createdAt: input.createdAt,
    message: input.message,
    provenanceRefs: input.provenanceRefs ?? [],
    restoresRevisionId: input.restoresRevisionId,
  });

  const nextGraph = freezeGraph(
    RevisionGraphSchema.parse({
      ...graph,
      revisions: { ...graph.revisions, [revision.id]: revision },
      changeSets: { ...graph.changeSets, [changeSet.id]: changeSet },
      branches: {
        ...graph.branches,
        [branch.id]: { ...branch, headRevisionId: revision.id },
      },
    })
  );

  return {
    graph: nextGraph,
    manuscript: applied.manuscript,
    revision: deepFreeze(revision) as Revision,
    contentVersions: deepFreeze(applied.contentVersions) as ContentVersion[],
  };
}

export type RestoreRevisionInput = Omit<
  CommitChangeSetInput,
  "restoresRevisionId"
> & {
  restoresRevisionId: string;
};

export function restoreRevision(
  input: RestoreRevisionInput
): CommitChangeSetResult {
  return commitChangeSet(input);
}

export function getRevisionAncestors(
  graph: RevisionGraph,
  revisionId: string
): string[] {
  const current = RevisionGraphSchema.parse(graph);
  const revision = current.revisions[revisionId];
  if (revision === undefined) {
    throw new Error(`revision not found: ${revisionId}`);
  }

  const result: string[] = [];
  const seen = new Set<string>();
  const queue = [...revision.parentIds];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (seen.has(parentId)) continue;
    seen.add(parentId);
    result.push(parentId);
    const parent = current.revisions[parentId];
    if (parent !== undefined) {
      queue.push(...parent.parentIds);
    }
  }
  return result;
}
