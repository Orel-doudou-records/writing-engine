import { z } from "zod";
import {
  ContributorRefSchema,
  DomainEntityRefSchema,
  type ContributorRef,
  type DomainEntityRef,
  type LiteraryManuscript,
} from "./index.js";
import {
  ChangeSchema,
  createChangeSet,
  createWorkBranch,
  commitChangeSet,
  RevisionGraphSchema,
  type Change,
  type Revision,
  type RevisionGraph,
} from "./versioning.js";
import {
  ProposalSchema,
  createProposal,
  integrateProposal as integrateProposalUnchecked,
  type IntegrateProposalInput,
  type IntegrateProposalResult,
  type Proposal,
  type ProposalItem,
  type ProposalStatus,
  type ReviewDecision,
} from "./proposal.js";

const IdSchema = z.string().trim().min(1);

export const ConflictKindSchema = z.enum([
  "version",
  "textual",
  "structural",
  "editorial",
]);
export type ConflictKind = z.infer<typeof ConflictKindSchema>;

export const EditorialConflictDeclarationSchema = z.object({
  id: IdSchema,
  proposalItemId: IdSchema.optional(),
  reason: z.string().trim().min(1),
  declaredBy: DomainEntityRefSchema.optional(),
});
export type EditorialConflictDeclaration = z.infer<
  typeof EditorialConflictDeclarationSchema
>;

export const ConflictSchema = z.object({
  id: IdSchema,
  kind: ConflictKindSchema,
  blocking: z.boolean(),
  reason: z.string().trim().min(1),
  proposalItemId: IdSchema.optional(),
  baseRevisionId: IdSchema,
  currentRevisionId: IdSchema,
  currentChangeSetId: IdSchema.optional(),
  currentChangeIndex: z.number().int().nonnegative().optional(),
  proposedChange: ChangeSchema.optional(),
  currentChange: ChangeSchema.optional(),
  declaredBy: DomainEntityRefSchema.optional(),
});
export type Conflict = z.infer<typeof ConflictSchema>;

export const ConflictAssessmentSchema = z.object({
  proposalId: IdSchema,
  targetBranchId: IdSchema,
  baseRevisionId: IdSchema,
  currentRevisionId: IdSchema,
  stale: z.boolean(),
  canAutoReconcile: z.boolean(),
  conflicts: z.array(ConflictSchema),
});
export type ConflictAssessment = z.infer<typeof ConflictAssessmentSchema>;

type CurrentChange = {
  revisionId: string;
  changeSetId: string;
  changeIndex: number;
  change: Change;
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function dedupeRefs(refs: DomainEntityRef[]): DomainEntityRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveItemChange(graph: RevisionGraph, item: ProposalItem): Change {
  const revision = graph.revisions[item.sourceRevisionId];
  if (revision === undefined || revision.changeSetId !== item.changeSetId) {
    throw new Error(`proposal source revision is no longer resolvable: ${item.sourceRevisionId}`);
  }
  const changeSet = graph.changeSets[item.changeSetId];
  const change = changeSet?.changes[item.changeIndex];
  if (change === undefined) {
    throw new Error(`proposal source change is no longer resolvable: ${item.id}`);
  }
  return ChangeSchema.parse(change);
}

function latestAuthorizedDecisiveDecision(
  proposal: Proposal,
  itemId: string
): ReviewDecision | undefined {
  for (let index = proposal.reviewDecisions.length - 1; index >= 0; index -= 1) {
    const decision = proposal.reviewDecisions[index];
    if (
      decision.itemId === itemId &&
      decision.authorized &&
      decision.decision !== "comment"
    ) {
      return decision;
    }
  }
  return undefined;
}

function projectReviewedStatus(proposal: Proposal): ProposalStatus {
  if (proposal.submittedAt === undefined && proposal.reviewDecisions.length === 0) {
    return "draft";
  }
  const current = proposal.items.map((item) =>
    latestAuthorizedDecisiveDecision(proposal, item.id)
  );
  if (current.some((decision) => decision?.decision === "request_changes")) {
    return "changes_requested";
  }
  if (current.some((decision) => decision === undefined)) {
    return "submitted";
  }
  const decisions = current.map((decision) => decision!.decision);
  if (decisions.every((decision) => decision === "reject")) {
    return "rejected";
  }
  if (decisions.every((decision) => decision === "accept" || decision === "reject")) {
    return "approved";
  }
  return "submitted";
}

function firstParentChangesBetween(
  graph: RevisionGraph,
  baseRevisionId: string,
  headRevisionId: string
): { compatiblePath: boolean; changes: CurrentChange[] } {
  if (baseRevisionId === headRevisionId) {
    return { compatiblePath: true, changes: [] };
  }

  const changes: CurrentChange[] = [];
  const seen = new Set<string>();
  let cursor = headRevisionId;

  while (cursor !== baseRevisionId) {
    if (seen.has(cursor)) {
      return { compatiblePath: false, changes };
    }
    seen.add(cursor);
    const revision = graph.revisions[cursor];
    if (revision === undefined) {
      return { compatiblePath: false, changes };
    }
    const changeSet = graph.changeSets[revision.changeSetId];
    changeSet?.changes.forEach((change, changeIndex) => {
      changes.push({
        revisionId: revision.id,
        changeSetId: revision.changeSetId,
        changeIndex,
        change: ChangeSchema.parse(change),
      });
    });
    const parent = revision.parentIds[0];
    if (parent === undefined) {
      return { compatiblePath: false, changes };
    }
    cursor = parent;
  }

  return { compatiblePath: true, changes };
}

const structuralKinds = new Set<Change["kind"]>([
  "insert_node",
  "remove_node",
  "move_node",
  "split_node",
  "merge_nodes",
]);

function subjectNodeIds(change: Change): string[] {
  switch (change.kind) {
    case "replace_content":
    case "remove_node":
    case "move_node":
    case "split_node":
    case "update_node_metadata":
      return [change.nodeId];
    case "insert_node":
      return [change.node.id];
    case "merge_nodes":
      return [...change.nodeIds, change.merged.id];
  }
}

function sameExplicitPosition(left: Change, right: Change): boolean {
  const leftPlacement =
    left.kind === "move_node"
      ? { parentId: left.parentId, index: left.index }
      : left.kind === "insert_node"
        ? { parentId: left.node.parentId, index: left.node.index }
        : undefined;
  const rightPlacement =
    right.kind === "move_node"
      ? { parentId: right.parentId, index: right.index }
      : right.kind === "insert_node"
        ? { parentId: right.node.parentId, index: right.node.index }
        : undefined;
  return (
    leftPlacement !== undefined &&
    rightPlacement !== undefined &&
    leftPlacement.parentId === rightPlacement.parentId &&
    leftPlacement.index !== undefined &&
    leftPlacement.index === rightPlacement.index
  );
}

function pairConflictKind(proposed: Change, current: Change): ConflictKind | undefined {
  const proposedIds = new Set(subjectNodeIds(proposed));
  const overlap = subjectNodeIds(current).some((id) => proposedIds.has(id));

  if (
    proposed.kind === "replace_content" &&
    current.kind === "replace_content" &&
    proposed.nodeId === current.nodeId
  ) {
    // replace_content is paragraph-granular today. Until ranged changes exist,
    // same-node replacements are not considered deterministically mergeable.
    return "textual";
  }

  if (structuralKinds.has(proposed.kind) || structuralKinds.has(current.kind)) {
    if (overlap || sameExplicitPosition(proposed, current)) {
      return "structural";
    }
  }

  if (
    proposed.kind === "update_node_metadata" &&
    current.kind === "update_node_metadata" &&
    proposed.nodeId === current.nodeId
  ) {
    const titleOverlap =
      proposed.metadata.title !== undefined && current.metadata.title !== undefined;
    const domainOverlap =
      proposed.metadata.domainRefs !== undefined && current.metadata.domainRefs !== undefined;
    if (titleOverlap || domainOverlap) return "textual";
  }

  return undefined;
}

export type AssessProposalIntegrationInput = {
  proposal: Proposal;
  graph: RevisionGraph;
  targetBranchId: string;
  editorialConflicts?: EditorialConflictDeclaration[];
};

export function assessProposalIntegration(
  input: AssessProposalIntegrationInput
): ConflictAssessment {
  const graph = RevisionGraphSchema.parse(input.graph);
  const proposal = ProposalSchema.parse(input.proposal);
  const target = graph.branches[input.targetBranchId];
  if (target === undefined) {
    throw new Error(`target branch not found: ${input.targetBranchId}`);
  }
  if (!target.canonical) {
    throw new Error("conflict assessment target must be canonical");
  }
  if (proposal.projectId !== graph.projectId) {
    throw new Error("proposal project must match revision graph project");
  }

  const stale = proposal.baseRevisionId !== target.headRevisionId;
  const between = firstParentChangesBetween(
    graph,
    proposal.baseRevisionId,
    target.headRevisionId
  );
  const conflicts: Conflict[] = [];

  if (stale) {
    conflicts.push(
      ConflictSchema.parse({
        id: `version:${proposal.id}:${target.headRevisionId}`,
        kind: "version",
        blocking: !between.compatiblePath,
        reason: between.compatiblePath
          ? "The reference text advanced since this proposal was prepared."
          : "The proposal base is not on the current canonical revision path.",
        baseRevisionId: proposal.baseRevisionId,
        currentRevisionId: target.headRevisionId,
      })
    );
  }

  const candidateItems = proposal.items.filter(
    (item) => latestAuthorizedDecisiveDecision(proposal, item.id)?.decision === "accept"
  );

  for (const item of candidateItems) {
    const proposedChange = resolveItemChange(graph, item);
    for (const current of between.changes) {
      const kind = pairConflictKind(proposedChange, current.change);
      if (kind === undefined) continue;
      conflicts.push(
        ConflictSchema.parse({
          id: `${kind}:${proposal.id}:${item.id}:${current.revisionId}:${current.changeIndex}`,
          kind,
          blocking: true,
          reason:
            kind === "textual"
              ? "The proposed and current changes modify incompatible content on the same literary unit."
              : "The proposed and current structural operations affect the same literary identity or position.",
          proposalItemId: item.id,
          baseRevisionId: proposal.baseRevisionId,
          currentRevisionId: current.revisionId,
          currentChangeSetId: current.changeSetId,
          currentChangeIndex: current.changeIndex,
          proposedChange,
          currentChange: current.change,
        })
      );
    }
  }

  for (const declarationInput of input.editorialConflicts ?? []) {
    const declaration = EditorialConflictDeclarationSchema.parse(declarationInput);
    if (
      declaration.proposalItemId !== undefined &&
      !proposal.items.some((item) => item.id === declaration.proposalItemId)
    ) {
      throw new Error(`proposal item not found: ${declaration.proposalItemId}`);
    }
    const proposedChange =
      declaration.proposalItemId === undefined
        ? undefined
        : resolveItemChange(
            graph,
            proposal.items.find((item) => item.id === declaration.proposalItemId)!
          );
    conflicts.push(
      ConflictSchema.parse({
        id: declaration.id,
        kind: "editorial",
        blocking: true,
        reason: declaration.reason,
        proposalItemId: declaration.proposalItemId,
        baseRevisionId: proposal.baseRevisionId,
        currentRevisionId: target.headRevisionId,
        proposedChange,
        declaredBy: declaration.declaredBy,
      })
    );
  }

  return deepFreeze(
    ConflictAssessmentSchema.parse({
      proposalId: proposal.id,
      targetBranchId: target.id,
      baseRevisionId: proposal.baseRevisionId,
      currentRevisionId: target.headRevisionId,
      stale,
      canAutoReconcile:
        between.compatiblePath && !conflicts.some((conflict) => conflict.blocking),
      conflicts,
    })
  );
}

export function markProposalStale(proposal: Proposal): Proposal {
  const current = ProposalSchema.parse(proposal);
  if (current.status === "integrated") {
    throw new Error("integrated proposal cannot become stale");
  }
  return deepFreeze(ProposalSchema.parse({ ...current, status: "stale" }));
}

export type AdaptStaleProposalInput = {
  proposal: Proposal;
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  targetBranchId: string;
  branchId: string;
  revisionId: string;
  changeSetId: string;
  proposalId: string;
  contributor: ContributorRef;
  createdAt: string;
  editorialConflicts?: EditorialConflictDeclaration[];
};

export type AdaptStaleProposalResult = {
  assessment: ConflictAssessment;
  staleProposal: Proposal;
  proposal: Proposal;
  graph: RevisionGraph;
  workspaceManuscript: LiteraryManuscript;
  revision: Revision;
};

export function adaptStaleProposal(
  input: AdaptStaleProposalInput
): AdaptStaleProposalResult {
  const proposal = ProposalSchema.parse(input.proposal);
  const graph = RevisionGraphSchema.parse(input.graph);
  const assessment = assessProposalIntegration({
    proposal,
    graph,
    targetBranchId: input.targetBranchId,
    editorialConflicts: input.editorialConflicts,
  });
  if (!assessment.stale) {
    throw new Error("proposal is not stale");
  }
  if (!assessment.canAutoReconcile) {
    throw new ProposalConflictError(
      "stale proposal cannot be adapted automatically",
      assessment,
      markProposalStale(proposal)
    );
  }

  const target = graph.branches[input.targetBranchId];
  if (target === undefined || !target.canonical) {
    throw new Error("stale proposal adaptation target must be canonical");
  }

  let nextGraph = createWorkBranch(graph, {
    id: input.branchId,
    kind: "workspace",
    fromRevisionId: target.headRevisionId,
  });
  const rebasedChanges = proposal.items.map((item) =>
    ChangeSchema.parse({
      ...resolveItemChange(graph, item),
      baseRevisionId: target.headRevisionId,
    })
  );
  const committed = commitChangeSet({
    graph: nextGraph,
    manuscript: input.manuscript,
    branchId: input.branchId,
    revisionId: input.revisionId,
    expectedHeadRevisionId: target.headRevisionId,
    changeSet: createChangeSet({ id: input.changeSetId, changes: rebasedChanges }),
    author: ContributorRefSchema.parse(input.contributor),
    createdAt: input.createdAt,
    provenanceRefs: dedupeRefs([
      ...proposal.provenanceRefs,
      { kind: "adapted_from_proposal", id: proposal.id },
    ]),
  });
  nextGraph = committed.graph;

  const draft = createProposal({
    graph: nextGraph,
    id: input.proposalId,
    projectId: proposal.projectId,
    sourceBranchId: input.branchId,
    sourceHeadRevisionId: input.revisionId,
    baseRevisionId: target.headRevisionId,
    proposer: proposal.proposer,
    createdAt: input.createdAt,
    provenanceRefs: dedupeRefs([
      ...proposal.provenanceRefs,
      { kind: "adapted_from_proposal", id: proposal.id },
    ]),
    items: proposal.items.map((item, changeIndex) => ({
      id: item.id,
      sourceRevisionId: input.revisionId,
      changeIndex,
    })),
  });

  const remappedDecisions = proposal.reviewDecisions.map((decision) => ({
    ...decision,
    proposalId: input.proposalId,
  }));
  const withHistory = ProposalSchema.parse({
    ...draft,
    submittedAt: proposal.submittedAt,
    reviewDecisions: remappedDecisions,
  });
  const adaptedProposal = deepFreeze(
    ProposalSchema.parse({
      ...withHistory,
      status: projectReviewedStatus(withHistory),
    })
  );

  return deepFreeze({
    assessment,
    staleProposal: markProposalStale(proposal),
    proposal: adaptedProposal,
    graph: nextGraph,
    workspaceManuscript: committed.manuscript,
    revision: committed.revision,
  });
}

export class ProposalConflictError extends Error {
  readonly assessment: ConflictAssessment;
  readonly staleProposal?: Proposal;

  constructor(
    message: string,
    assessment: ConflictAssessment,
    staleProposal?: Proposal
  ) {
    super(message);
    this.name = "ProposalConflictError";
    this.assessment = assessment;
    this.staleProposal = staleProposal;
  }
}

export type ConflictAwareIntegrateProposalInput = IntegrateProposalInput & {
  editorialConflicts?: EditorialConflictDeclaration[];
};

export function integrateProposal(
  input: ConflictAwareIntegrateProposalInput
): IntegrateProposalResult {
  const assessment = assessProposalIntegration({
    proposal: input.proposal,
    graph: input.graph,
    targetBranchId: input.targetBranchId,
    editorialConflicts: input.editorialConflicts,
  });

  if (assessment.stale) {
    throw new ProposalConflictError(
      "proposal is stale; adapt it to the current reference text before integration",
      assessment,
      markProposalStale(input.proposal)
    );
  }
  if (!assessment.canAutoReconcile) {
    throw new ProposalConflictError(
      "proposal integration is blocked by conflicts",
      assessment
    );
  }

  return integrateProposalUnchecked(input);
}
