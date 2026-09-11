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
  commitChangeSet,
  getRevisionAncestors,
  RevisionGraphSchema,
  type Change,
  type CommitChangeSetResult,
  type RevisionGraph,
} from "./versioning.js";

const IdSchema = z.string().trim().min(1);

export const ProposalStatusSchema = z.enum([
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "rejected",
  "integrated",
  "stale",
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ReviewDecisionKindSchema = z.enum([
  "accept",
  "reject",
  "request_changes",
  "comment",
]);
export type ReviewDecisionKind = z.infer<typeof ReviewDecisionKindSchema>;

export const ProposalItemSchema = z.object({
  id: IdSchema,
  sourceRevisionId: IdSchema,
  changeSetId: IdSchema,
  changeIndex: z.number().int().nonnegative(),
});
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const ReviewDecisionSchema = z
  .object({
    id: IdSchema,
    proposalId: IdSchema,
    itemId: IdSchema,
    reviewer: ContributorRefSchema,
    decision: ReviewDecisionKindSchema,
    authorized: z.boolean(),
    comment: z.string().trim().min(1).optional(),
    createdAt: z.string().datetime(),
  })
  .superRefine((decision, context) => {
    if (decision.decision === "comment" && decision.comment === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "comment decisions require comment text",
        path: ["comment"],
      });
    }
  });
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ProposalSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    sourceBranchId: IdSchema,
    sourceHeadRevisionId: IdSchema,
    baseRevisionId: IdSchema,
    proposer: ContributorRefSchema,
    status: ProposalStatusSchema,
    items: z.array(ProposalItemSchema).min(1),
    reviewDecisions: z.array(ReviewDecisionSchema).default([]),
    provenanceRefs: z.array(DomainEntityRefSchema).default([]),
    createdAt: z.string().datetime(),
    submittedAt: z.string().datetime().optional(),
    integrationId: IdSchema.optional(),
  })
  .superRefine((proposal, context) => {
    const itemIds = proposal.items.map((item) => item.id);
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proposal item ids must be unique",
        path: ["items"],
      });
    }

    const decisionIds = proposal.reviewDecisions.map((decision) => decision.id);
    if (new Set(decisionIds).size !== decisionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "review decision ids must be unique",
        path: ["reviewDecisions"],
      });
    }

    const knownItemIds = new Set(itemIds);
    proposal.reviewDecisions.forEach((decision, index) => {
      if (decision.proposalId !== proposal.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "review decision must belong to the proposal",
          path: ["reviewDecisions", index, "proposalId"],
        });
      }
      if (!knownItemIds.has(decision.itemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "review decision must target a proposal item",
          path: ["reviewDecisions", index, "itemId"],
        });
      }
    });
  });
export type Proposal = z.infer<typeof ProposalSchema>;

export const IntegrationSchema = z.object({
  id: IdSchema,
  proposalId: IdSchema,
  revisionId: IdSchema,
  acceptedItemIds: z.array(IdSchema),
  rejectedItemIds: z.array(IdSchema),
  decisionIds: z.array(IdSchema),
  integrator: ContributorRefSchema,
  provenanceRefs: z.array(DomainEntityRefSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Integration = z.infer<typeof IntegrationSchema>;

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

function freezeProposal(proposal: Proposal): Proposal {
  return deepFreeze(proposal) as Proposal;
}

function freezeIntegration(integration: Integration): Integration {
  return deepFreeze(integration) as Integration;
}

export type ProposalItemInput = {
  id: string;
  sourceRevisionId: string;
  changeIndex: number;
};

export type CreateProposalInput = {
  graph: RevisionGraph;
  id: string;
  projectId: string;
  sourceBranchId: string;
  sourceHeadRevisionId: string;
  baseRevisionId: string;
  proposer: ContributorRef;
  createdAt: string;
  items: ProposalItemInput[];
  provenanceRefs?: DomainEntityRef[];
};

function revisionIsAtOrBelow(
  graph: RevisionGraph,
  revisionId: string,
  ancestorId: string
): boolean {
  return revisionId === ancestorId || getRevisionAncestors(graph, revisionId).includes(ancestorId);
}

export function createProposal(input: CreateProposalInput): Proposal {
  const graph = RevisionGraphSchema.parse(input.graph);
  if (graph.projectId !== input.projectId) {
    throw new Error("proposal project must match revision graph project");
  }

  const sourceBranch = graph.branches[input.sourceBranchId];
  if (sourceBranch === undefined) {
    throw new Error(`source branch not found: ${input.sourceBranchId}`);
  }
  if (sourceBranch.canonical) {
    throw new Error("proposal source must be a workspace or variant");
  }
  if (sourceBranch.headRevisionId !== input.sourceHeadRevisionId) {
    throw new Error("proposal source head does not match branch head");
  }
  if (graph.revisions[input.baseRevisionId] === undefined) {
    throw new Error(`base revision not found: ${input.baseRevisionId}`);
  }
  if (!revisionIsAtOrBelow(graph, input.sourceHeadRevisionId, input.baseRevisionId)) {
    throw new Error("proposal base must be an ancestor of the source head");
  }

  const items = input.items.map((item) => {
    const sourceRevision = graph.revisions[item.sourceRevisionId];
    if (sourceRevision === undefined) {
      throw new Error(`source revision not found: ${item.sourceRevisionId}`);
    }
    if (sourceRevision.branchId !== input.sourceBranchId) {
      throw new Error("proposal item revision must belong to the source branch");
    }
    if (!revisionIsAtOrBelow(graph, input.sourceHeadRevisionId, item.sourceRevisionId)) {
      throw new Error("proposal item revision must be reachable from the source head");
    }
    const changeSet = graph.changeSets[sourceRevision.changeSetId];
    if (changeSet === undefined) {
      throw new Error(`ChangeSet not found: ${sourceRevision.changeSetId}`);
    }
    if (changeSet.changes[item.changeIndex] === undefined) {
      throw new Error(`change index out of range: ${item.changeIndex}`);
    }

    return ProposalItemSchema.parse({
      id: item.id,
      sourceRevisionId: sourceRevision.id,
      changeSetId: changeSet.id,
      changeIndex: item.changeIndex,
    });
  });

  return freezeProposal(
    ProposalSchema.parse({
      id: input.id,
      projectId: input.projectId,
      sourceBranchId: input.sourceBranchId,
      sourceHeadRevisionId: input.sourceHeadRevisionId,
      baseRevisionId: input.baseRevisionId,
      proposer: input.proposer,
      status: "draft",
      items,
      reviewDecisions: [],
      provenanceRefs: input.provenanceRefs ?? [],
      createdAt: input.createdAt,
    })
  );
}

export function submitProposal(
  proposal: Proposal,
  input: { submittedAt: string }
): Proposal {
  const current = ProposalSchema.parse(proposal);
  if (current.status !== "draft" && current.status !== "changes_requested") {
    throw new Error(`proposal cannot be submitted from status: ${current.status}`);
  }
  return freezeProposal(
    ProposalSchema.parse({
      ...current,
      status: "submitted",
      submittedAt: input.submittedAt,
    })
  );
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

export type ReviewProposalSelectionInput = {
  itemIds: string[];
  decision: ReviewDecisionKind;
  reviewer: ContributorRef;
  authorized: boolean;
  comment?: string;
  decisionIdPrefix: string;
  createdAt: string;
};

export function reviewProposalSelection(
  proposal: Proposal,
  input: ReviewProposalSelectionInput
): Proposal {
  const current = ProposalSchema.parse(proposal);
  if (
    current.status === "draft" ||
    current.status === "integrated" ||
    current.status === "stale"
  ) {
    throw new Error(`proposal cannot be reviewed from status: ${current.status}`);
  }
  if (input.itemIds.length === 0) {
    throw new Error("review selection must contain at least one proposal item");
  }

  const knownItemIds = new Set(current.items.map((item) => item.id));
  const uniqueItemIds = [...new Set(input.itemIds)];
  for (const itemId of uniqueItemIds) {
    if (!knownItemIds.has(itemId)) {
      throw new Error(`proposal item not found: ${itemId}`);
    }
  }

  const appended = uniqueItemIds.map((itemId) =>
    ReviewDecisionSchema.parse({
      id: `${input.decisionIdPrefix}:${itemId}`,
      proposalId: current.id,
      itemId,
      reviewer: input.reviewer,
      decision: input.decision,
      authorized: input.authorized,
      comment: input.comment,
      createdAt: input.createdAt,
    })
  );

  const next = ProposalSchema.parse({
    ...current,
    reviewDecisions: [...current.reviewDecisions, ...appended],
  });
  return freezeProposal(
    ProposalSchema.parse({
      ...next,
      status: projectReviewedStatus(next),
    })
  );
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

function rebaseChange(change: Change, baseRevisionId: string): Change {
  return ChangeSchema.parse({ ...change, baseRevisionId });
}

function dedupeRefs(refs: DomainEntityRef[]): DomainEntityRef[] {
  const seen = new Set<string>();
  const result: DomainEntityRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    }
  }
  return result;
}

export type IntegrateProposalInput = {
  proposal: Proposal;
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  targetBranchId: string;
  expectedHeadRevisionId: string;
  revisionId: string;
  integrationId: string;
  integrator: ContributorRef;
  createdAt: string;
  additionalParentIds?: string[];
  message?: string;
  provenanceRefs?: DomainEntityRef[];
};

export type IntegrateProposalResult = {
  proposal: Proposal;
  integration: Integration;
  commit: CommitChangeSetResult;
};

export function integrateProposal(
  input: IntegrateProposalInput
): IntegrateProposalResult {
  const graph = RevisionGraphSchema.parse(input.graph);
  const proposal = ProposalSchema.parse(input.proposal);

  if (proposal.projectId !== graph.projectId) {
    throw new Error("proposal project must match revision graph project");
  }
  if (proposal.status === "integrated") {
    throw new Error("proposal is already integrated");
  }

  const acceptedItems: ProposalItem[] = [];
  const rejectedItemIds: string[] = [];
  for (const item of proposal.items) {
    const decision = latestAuthorizedDecisiveDecision(proposal, item.id);
    if (decision?.decision === "accept") acceptedItems.push(item);
    if (decision?.decision === "reject") rejectedItemIds.push(item.id);
  }

  if (acceptedItems.length === 0) {
    throw new Error("proposal has no accepted authorized changes");
  }
  if (proposal.status !== "approved") {
    throw new Error(`proposal is not approved: ${proposal.status}`);
  }

  const targetBranch = graph.branches[input.targetBranchId];
  if (targetBranch === undefined) {
    throw new Error(`target branch not found: ${input.targetBranchId}`);
  }
  if (!targetBranch.canonical) {
    throw new Error("proposal integration target must be canonical");
  }
  if (targetBranch.headRevisionId !== input.expectedHeadRevisionId) {
    throw new Error("integration target head changed");
  }
  if (proposal.baseRevisionId !== input.expectedHeadRevisionId) {
    throw new Error("proposal base no longer matches the canonical head");
  }

  const acceptedChanges = acceptedItems.map((item) =>
    rebaseChange(resolveItemChange(graph, item), input.expectedHeadRevisionId)
  );

  const sourceRevisionRefs = acceptedItems.map((item) => ({
    kind: "source_revision",
    id: item.sourceRevisionId,
  }));
  const sourceProvenance = acceptedItems.flatMap(
    (item) => graph.revisions[item.sourceRevisionId]?.provenanceRefs ?? []
  );
  const reviewRefs = proposal.reviewDecisions.map((decision) => ({
    kind: "review_decision",
    id: decision.id,
  }));
  const provenanceRefs = dedupeRefs([
    { kind: "proposal", id: proposal.id },
    ...reviewRefs,
    ...sourceRevisionRefs,
    ...proposal.provenanceRefs,
    ...sourceProvenance,
    ...(input.provenanceRefs ?? []),
  ]);

  const commit = commitChangeSet({
    graph,
    manuscript: input.manuscript,
    branchId: input.targetBranchId,
    revisionId: input.revisionId,
    expectedHeadRevisionId: input.expectedHeadRevisionId,
    changeSet: createChangeSet({
      id: `integration:${input.integrationId}`,
      changes: acceptedChanges,
    }),
    author: input.integrator,
    createdAt: input.createdAt,
    message: input.message ?? `Integrate proposal ${proposal.id}`,
    provenanceRefs,
    additionalParentIds: input.additionalParentIds,
  });

  const integration = freezeIntegration(
    IntegrationSchema.parse({
      id: input.integrationId,
      proposalId: proposal.id,
      revisionId: commit.revision.id,
      acceptedItemIds: acceptedItems.map((item) => item.id),
      rejectedItemIds,
      decisionIds: proposal.reviewDecisions.map((decision) => decision.id),
      integrator: input.integrator,
      provenanceRefs,
      createdAt: input.createdAt,
    })
  );

  const integratedProposal = freezeProposal(
    ProposalSchema.parse({
      ...proposal,
      status: "integrated",
      integrationId: integration.id,
    })
  );

  return {
    proposal: integratedProposal,
    integration,
    commit,
  };
}
