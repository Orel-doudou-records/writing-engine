import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ContentVersionSchema,
  type LiteraryManuscript,
} from "./index.js";
import type { CollaborativeCoreStore } from "./persistence.js";
import {
  authorizeContribution,
  ContributionModeSchema,
  type Contributor,
  type RoleBinding,
  type ContributionPolicy,
  type PermissionGrant,
} from "./collaboration.js";
import { commitChangeSet, createChangeSet, type CommitChangeSetResult } from "./versioning.js";
import { createProposal, submitProposal, ProposalSchema, type Proposal, type IntegrateProposalResult } from "./proposal.js";
import { integrateProposal, type ConflictAwareIntegrateProposalInput } from "./conflicts.js";

const IdSchema = z.string().trim().min(1);
const LanguageSchema = z.string().trim().min(1).transform((value, context) => {
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid language tag" });
    return z.NEVER;
  }
});
const EndpointSchema = z.object({
  projectId: IdSchema,
  branchId: IdSchema,
  revisionId: IdSchema,
  language: LanguageSchema,
});
const MappingSchema = z.object({ sourceNodeId: IdSchema, targetNodeId: IdSchema });
const PrepareInputSchema = z.object({
  id: IdSchema,
  source: EndpointSchema,
  target: EndpointSchema,
  mappings: z.array(MappingSchema).min(1),
});
export type PrepareTranslationInput = z.input<typeof PrepareInputSchema>;

export const TranslationRequestSchema = z.object({
  id: IdSchema,
  source: EndpointSchema,
  target: EndpointSchema.extend({ canonicalBranchId: IdSchema, canonicalRevisionId: IdSchema }),
  units: z.array(z.object({ source: ContentVersionSchema, targetNodeId: IdSchema })).min(1),
});
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;
export type TranslationSourceAssessment = {
  status: "current" | "stale" | "missing";
  currentRevisionId?: string;
};

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

async function loadEndpoint(store: CollaborativeCoreStore, endpoint: z.infer<typeof EndpointSchema>) {
  const graph = await store.loadRevisionGraph(endpoint.projectId);
  const branch = graph?.branches[endpoint.branchId];
  if (!graph || !branch || !graph.revisions[endpoint.revisionId]) {
    throw new Error("translation endpoint not found");
  }
  const manuscript = await store.loadManuscriptAtRevision(endpoint.projectId, endpoint.revisionId);
  if (!manuscript) throw new Error("translation snapshot not found");
  return { graph, branch, manuscript };
}

function paragraph(manuscript: LiteraryManuscript, nodeId: string) {
  const node = manuscript.nodes[nodeId];
  if (!node || node.removed || node.kind !== "paragraph") {
    throw new Error(`translation requires an existing paragraph: ${nodeId}`);
  }
  return node;
}

async function readUnits(
  store: CollaborativeCoreStore,
  input: PrepareTranslationInput,
  source: LiteraryManuscript,
  target: LiteraryManuscript,
): Promise<TranslationRequest["units"]> {
  for (const key of ["sourceNodeId", "targetNodeId"] as const) {
    if (new Set(input.mappings.map((mapping) => mapping[key])).size !== input.mappings.length) {
      throw new Error("translation mappings must be one-to-one");
    }
  }
  return Promise.all(input.mappings.map(async (mapping) => {
    const node = paragraph(source, mapping.sourceNodeId);
    paragraph(target, mapping.targetNodeId);
    if (!node.contentRef) throw new Error("translation source has no content");
    const value = await store.resolveContentVersion(
      input.source.projectId, input.source.revisionId, node.id, node.contentRef.version,
    );
    if (!value) throw new Error("translation source content not found");
    const content = ContentVersionSchema.parse(value);
    if (content.nodeId !== node.id || content.version !== node.contentRef.version ||
        content.contentHash !== createHash("sha256").update(content.content).digest("hex")) {
      throw new Error("translation source content integrity mismatch");
    }
    return { source: content, targetNodeId: mapping.targetNodeId };
  }));
}

function validateEndpoints(input: PrepareTranslationInput, canonicalBranchId: string) {
  if (input.source.language === input.target.language) {
    throw new Error("translation languages must differ");
  }
  if (input.source.projectId === input.target.projectId &&
      [input.target.branchId, canonicalBranchId].includes(input.source.branchId)) {
    throw new Error("translation must preserve the source branch, including during integration");
  }
}

/** Explicit preparation only: reads source text, never invokes a provider or writes to the store. */
export async function prepareTranslation(
  store: CollaborativeCoreStore,
  input: PrepareTranslationInput,
): Promise<TranslationRequest> {
  const parsed = PrepareInputSchema.parse(input);
  const source = await loadEndpoint(store, parsed.source);
  const target = await loadEndpoint(store, parsed.target);
  validateEndpoints(parsed, target.graph.canonicalBranchId);
  if (source.branch.headRevisionId !== parsed.source.revisionId ||
      target.branch.headRevisionId !== parsed.target.revisionId) {
    throw new Error("translation endpoint head changed");
  }
  if (target.branch.canonical || target.branch.kind !== "workspace") {
    throw new Error("translation target requires a non-canonical workspace");
  }
  return freeze(TranslationRequestSchema.parse({
    id: parsed.id,
    source: parsed.source,
    target: {
      ...parsed.target,
      canonicalBranchId: target.graph.canonicalBranchId,
      canonicalRevisionId: target.graph.branches[target.graph.canonicalBranchId].headRevisionId,
    },
    units: await readUnits(store, parsed, source.manuscript, target.manuscript),
  }));
}

/** Conservative source freshness, not a statement about translation quality or approval. */
export async function assessTranslationSource(
  store: CollaborativeCoreStore,
  value: TranslationRequest,
): Promise<TranslationSourceAssessment> {
  const request = TranslationRequestSchema.parse(value);
  const graph = await store.loadRevisionGraph(request.source.projectId);
  const branch = graph?.branches[request.source.branchId];
  if (!graph || !branch || !graph.revisions[request.source.revisionId]) {
    return freeze({ status: "missing" });
  }
  const currentRevisionId = branch.headRevisionId;
  if (currentRevisionId !== request.source.revisionId) return freeze({ status: "stale", currentRevisionId });
  const manuscript = await store.loadManuscriptAtRevision(request.source.projectId, request.source.revisionId);
  if (!manuscript) return freeze({ status: "missing", currentRevisionId });
  for (const unit of request.units) {
    const node = manuscript.nodes[unit.source.nodeId];
    if (!node || node.removed || node.kind !== "paragraph" || !node.contentRef) {
      return freeze({ status: "missing", currentRevisionId });
    }
    const content = await store.resolveContentVersion(request.source.projectId, request.source.revisionId, node.id, node.contentRef.version);
    if (!content) return freeze({ status: "missing", currentRevisionId });
    if (JSON.stringify(ContentVersionSchema.parse(content)) !== JSON.stringify(unit.source)) {
      return freeze({ status: "stale", currentRevisionId });
    }
  }
  return freeze({ status: "current", currentRevisionId });
}

export const TranslationBindingSchema = z.object({
  request: TranslationRequestSchema,
  mode: ContributionModeSchema,
  revisionId: IdSchema,
  changeSetId: IdSchema,
  proposalId: IdSchema.optional(),
});
export type TranslationBinding = z.infer<typeof TranslationBindingSchema>;

export type CreateTranslationContributionInput = {
  request: TranslationRequest;
  contributor: Contributor;
  roleBinding: RoleBinding;
  policy: ContributionPolicy;
  permissionGrants: PermissionGrant[];
  texts: { targetNodeId: string; content: string }[];
  revisionId: string;
  changeSetId: string;
  proposalId?: string;
  createdAt: string;
};
export type TranslationContribution = {
  binding: TranslationBinding;
  commit: CommitChangeSetResult;
  proposal?: Proposal;
};

// Commit provenance binds the entire normalized request, including mappings and source text.
function provenance(request: TranslationRequest) {
  return [
    { kind: "translation_request", id: request.id },
    { kind: "translation_request_sha256", id: createHash("sha256").update(JSON.stringify(request)).digest("hex") },
  ];
}

async function validateRequest(
  store: CollaborativeCoreStore,
  value: TranslationRequest,
  expectedWorkspaceHead: string,
) {
  const request = TranslationRequestSchema.parse(value);
  const source = await loadEndpoint(store, request.source);
  const target = await loadEndpoint(store, request.target);
  const input = {
    id: request.id, source: request.source, target: request.target,
    mappings: request.units.map((unit) => ({ sourceNodeId: unit.source.nodeId, targetNodeId: unit.targetNodeId })),
  };
  validateEndpoints(input, target.graph.canonicalBranchId);
  if (source.branch.headRevisionId !== request.source.revisionId) {
    throw new Error("translation source changed; prepare a new request and review");
  }
  if (target.branch.canonical || target.branch.kind !== "workspace") {
    throw new Error("translation target requires a non-canonical workspace");
  }
  if (target.branch.headRevisionId !== expectedWorkspaceHead ||
      target.graph.canonicalBranchId !== request.target.canonicalBranchId ||
      target.graph.branches[target.graph.canonicalBranchId].headRevisionId !== request.target.canonicalRevisionId) {
    throw new Error("translation target changed; prepare a new request and review");
  }
  const units = await readUnits(store, input, source.manuscript, target.manuscript);
  if (JSON.stringify(units) !== JSON.stringify(request.units)) {
    throw new Error("translation source provenance mismatch");
  }
  return { request, target };
}

/** Returns a workspace commit and, when required by policy, a normal CC1 proposal. */
export async function createTranslationContribution(
  store: CollaborativeCoreStore,
  input: CreateTranslationContributionInput,
): Promise<TranslationContribution> {
  const { request, target } = await validateRequest(store, input.request, input.request.target.revisionId);
  const texts = z.array(z.object({ targetNodeId: IdSchema, content: z.string() })).parse(input.texts);
  const byNode = new Map(texts.map((text) => [text.targetNodeId, text.content]));
  if (texts.length !== request.units.length || byNode.size !== texts.length ||
      request.units.some((unit) => !byNode.has(unit.targetNodeId))) {
    throw new Error("translation texts must cover every mapped target exactly once");
  }
  let mode: TranslationBinding["mode"] = "direct";
  for (const unit of request.units) {
    const authorization = authorizeContribution({
      contributor: input.contributor, roleBinding: input.roleBinding,
      policy: input.policy, permissionGrants: input.permissionGrants,
      projectId: request.target.projectId, operation: "replace_content",
      scope: { kind: "node", nodeId: unit.targetNodeId },
    });
    if (!authorization.authorized) throw new Error(`translation requires permission: ${unit.targetNodeId}`);
    if (authorization.mode === "propose") mode = "propose";
  }
  const proposalId = mode === "propose" ? IdSchema.parse(input.proposalId) : undefined;
  const commit = commitChangeSet({
    graph: target.graph, manuscript: target.manuscript,
    branchId: request.target.branchId, expectedHeadRevisionId: request.target.revisionId,
    revisionId: input.revisionId, author: { id: input.contributor.id }, createdAt: input.createdAt,
    provenanceRefs: provenance(request),
    changeSet: createChangeSet({
      id: input.changeSetId,
      changes: request.units.map((unit) => ({
        kind: "replace_content", baseRevisionId: request.target.revisionId,
        nodeId: unit.targetNodeId, content: byNode.get(unit.targetNodeId)!,
        // Exact workspace/canonical heads are checked above. A workspace-local content
        // ordinal cannot be used as a precondition when this proposal reaches canonical.
      })),
    }),
  });
  const proposal = proposalId === undefined ? undefined : submitProposal(createProposal({
    graph: commit.graph, id: proposalId, projectId: request.target.projectId,
    sourceBranchId: request.target.branchId, sourceHeadRevisionId: commit.revision.id,
    baseRevisionId: request.target.canonicalRevisionId,
    proposer: { id: input.contributor.id }, createdAt: input.createdAt,
    provenanceRefs: provenance(request),
    items: request.units.map((_, index) => ({
      id: `${proposalId}:${index}`, sourceRevisionId: commit.revision.id, changeIndex: index,
    })),
  }), { submittedAt: input.createdAt });
  return freeze({
    binding: TranslationBindingSchema.parse({
      request, mode, revisionId: commit.revision.id, changeSetId: commit.revision.changeSetId, proposalId,
    }),
    commit, proposal,
  });
}

export type IntegrateTranslationProposalInput = Omit<
  ConflictAwareIntegrateProposalInput,
  "graph" | "manuscript" | "targetBranchId" | "additionalParentIds" | "provenanceRefs"
> & { binding: TranslationBinding };
export type TranslationIntegration = IntegrateProposalResult & {
  integratedUnits: TranslationRequest["units"];
};

/** The consumer must authorize the integrator and provide trusted review decisions. */
export async function integrateTranslationProposal(
  store: CollaborativeCoreStore,
  input: IntegrateTranslationProposalInput,
): Promise<TranslationIntegration> {
  const binding = TranslationBindingSchema.parse(input.binding);
  if (binding.mode !== "propose" || !binding.proposalId) {
    throw new Error("translation binding has no proposal");
  }
  const { request, target } = await validateRequest(store, binding.request, binding.revisionId);
  const proposal = ProposalSchema.parse(input.proposal);
  const revision = target.graph.revisions[binding.revisionId];
  const changes = target.graph.changeSets[binding.changeSetId]?.changes;
  const refs = provenance(request);
  if (!revision || revision.changeSetId !== binding.changeSetId ||
      revision.branchId !== request.target.branchId || revision.parentIds[0] !== request.target.revisionId ||
      !refs.every((ref) => revision.provenanceRefs.some((stored) => stored.kind === ref.kind && stored.id === ref.id)) ||
      !changes || changes.length !== request.units.length ||
      changes.some((change, index) => change.kind !== "replace_content" ||
        change.nodeId !== request.units[index].targetNodeId || change.baseRevisionId !== request.target.revisionId)) {
    throw new Error("translation contribution provenance mismatch");
  }
  if (proposal.id !== binding.proposalId || proposal.projectId !== request.target.projectId ||
      proposal.sourceBranchId !== request.target.branchId || proposal.sourceHeadRevisionId !== binding.revisionId ||
      proposal.baseRevisionId !== request.target.canonicalRevisionId || proposal.proposer.id !== revision.author.id ||
      proposal.items.length !== request.units.length ||
      proposal.items.some((item, index) => item.id !== `${proposal.id}:${index}` ||
        item.sourceRevisionId !== binding.revisionId || item.changeSetId !== binding.changeSetId || item.changeIndex !== index)) {
    throw new Error("translation proposal does not match its contribution");
  }
  const manuscript = await store.loadManuscriptAtRevision(request.target.projectId, request.target.canonicalRevisionId);
  if (!manuscript) throw new Error("translation canonical snapshot not found");
  const result = integrateProposal({
    ...input, proposal, graph: target.graph, manuscript,
    targetBranchId: request.target.canonicalBranchId,
    additionalParentIds: [binding.revisionId], provenanceRefs: refs,
  });
  return freeze({
    ...result,
    integratedUnits: request.units.filter((_, index) => result.integration.acceptedItemIds.includes(proposal.items[index].id)),
  });
}
