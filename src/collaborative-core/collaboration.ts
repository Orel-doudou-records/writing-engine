import { z } from "zod";
import { TextRangeSchema, type LiteraryManuscript } from "./index.js";
import {
  commitChangeSet,
  type ChangeSet,
  type CommitChangeSetResult,
  type RevisionGraph,
} from "./versioning.js";

const IdSchema = z.string().trim().min(1);

export const ContributorKindSchema = z.enum(["human", "agent"]);
export type ContributorKind = z.infer<typeof ContributorKindSchema>;

export const ContributorSchema = z.object({
  id: IdSchema,
  kind: ContributorKindSchema,
  displayName: z.string().trim().min(1),
});
export type Contributor = z.infer<typeof ContributorSchema>;

export const EditorialRoleSchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
});
export type EditorialRole = z.infer<typeof EditorialRoleSchema>;

export const RoleBindingSchema = z
  .object({
    contributorId: IdSchema,
    roleIds: z.array(IdSchema),
  })
  .superRefine((binding, context) => {
    if (new Set(binding.roleIds).size !== binding.roleIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "role ids must be unique",
        path: ["roleIds"],
      });
    }
  });
export type RoleBinding = z.infer<typeof RoleBindingSchema>;

export const CollaborationScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("project"),
    projectId: IdSchema,
  }),
  z.object({
    kind: z.literal("node"),
    nodeId: IdSchema,
    range: TextRangeSchema.optional(),
  }),
]);
export type CollaborationScope = z.infer<typeof CollaborationScopeSchema>;

export const AssignmentSchema = z.object({
  contributorId: IdSchema,
  scope: CollaborationScopeSchema,
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const TaskStatusSchema = z.enum(["todo", "in_progress", "in_review", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    title: z.string().trim().min(1),
    status: TaskStatusSchema,
    assignee: AssignmentSchema,
    reviewers: z.array(AssignmentSchema).default([]),
    collaborators: z.array(AssignmentSchema).default([]),
    workspaceBranchId: IdSchema.optional(),
  })
  .superRefine((task, context) => {
    const reviewerIds = task.reviewers.map((assignment) => assignment.contributorId);
    if (new Set(reviewerIds).size !== reviewerIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "task reviewers must be unique",
        path: ["reviewers"],
      });
    }

    const collaboratorIds = task.collaborators.map(
      (assignment) => assignment.contributorId
    );
    if (new Set(collaboratorIds).size !== collaboratorIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "task collaborators must be unique",
        path: ["collaborators"],
      });
    }
  });
export type Task = z.infer<typeof TaskSchema>;

export const ContributionOperationSchema = z.enum([
  "replace_content",
  "insert_node",
  "remove_node",
  "move_node",
  "split_node",
  "merge_nodes",
  "update_node_metadata",
]);
export type ContributionOperation = z.infer<typeof ContributionOperationSchema>;

export const PermissionGrantSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  contributorId: IdSchema,
  operation: ContributionOperationSchema,
  scope: CollaborationScopeSchema.optional(),
});
export type PermissionGrant = z.infer<typeof PermissionGrantSchema>;

export const ContributionModeSchema = z.enum(["direct", "propose"]);
export type ContributionMode = z.infer<typeof ContributionModeSchema>;

export const ContributionPolicyRuleSchema = z.object({
  id: IdSchema,
  contributorId: IdSchema.optional(),
  roleId: IdSchema.optional(),
  operation: ContributionOperationSchema.optional(),
  scope: CollaborationScopeSchema.optional(),
  mode: ContributionModeSchema,
});
export type ContributionPolicyRule = z.infer<typeof ContributionPolicyRuleSchema>;

export const ContributionPolicySchema = z.object({
  projectId: IdSchema,
  defaultMode: ContributionModeSchema.default("propose"),
  rules: z.array(ContributionPolicyRuleSchema).default([]),
});
export type ContributionPolicy = z.infer<typeof ContributionPolicySchema>;

function equalRange(
  left: { start: number; end: number } | undefined,
  right: { start: number; end: number } | undefined
): boolean {
  if (left === undefined) return true;
  return (
    right !== undefined && left.start === right.start && left.end === right.end
  );
}

function scopeMatches(
  selector: CollaborationScope | undefined,
  requested: CollaborationScope,
  projectId: string
): boolean {
  if (selector === undefined) return true;
  if (selector.kind === "project") {
    return selector.projectId === projectId;
  }
  return (
    requested.kind === "node" &&
    selector.nodeId === requested.nodeId &&
    equalRange(selector.range, requested.range)
  );
}

function requireMatchingBinding(
  contributor: Contributor,
  roleBinding: RoleBinding
): RoleBinding {
  const parsed = RoleBindingSchema.parse(roleBinding);
  if (parsed.contributorId !== contributor.id) {
    throw new Error("role binding must belong to the contributor");
  }
  return parsed;
}

export type ResolveContributionModeInput = {
  policy: ContributionPolicy;
  contributor: Contributor;
  roleBinding: RoleBinding;
  projectId: string;
  operation: ContributionOperation;
  scope: CollaborationScope;
};

export function resolveContributionMode(
  input: ResolveContributionModeInput
): ContributionMode {
  const policy = ContributionPolicySchema.parse(input.policy);
  const contributor = ContributorSchema.parse(input.contributor);
  const binding = requireMatchingBinding(contributor, input.roleBinding);
  const scope = CollaborationScopeSchema.parse(input.scope);
  const operation = ContributionOperationSchema.parse(input.operation);

  if (policy.projectId !== input.projectId) {
    throw new Error("contribution policy does not belong to the project");
  }

  for (const rule of policy.rules) {
    if (rule.contributorId !== undefined && rule.contributorId !== contributor.id) {
      continue;
    }
    if (rule.roleId !== undefined && !binding.roleIds.includes(rule.roleId)) {
      continue;
    }
    if (rule.operation !== undefined && rule.operation !== operation) {
      continue;
    }
    if (!scopeMatches(rule.scope, scope, input.projectId)) {
      continue;
    }
    return rule.mode;
  }

  return policy.defaultMode;
}

export type ContributionAuthorization =
  | { authorized: false; reason: "permission_required" }
  | { authorized: true; mode: ContributionMode };

export type AuthorizeContributionInput = ResolveContributionModeInput & {
  permissionGrants: PermissionGrant[];
};

export function authorizeContribution(
  input: AuthorizeContributionInput
): ContributionAuthorization {
  const contributor = ContributorSchema.parse(input.contributor);
  const scope = CollaborationScopeSchema.parse(input.scope);
  const operation = ContributionOperationSchema.parse(input.operation);
  requireMatchingBinding(contributor, input.roleBinding);

  const permitted = input.permissionGrants
    .map((grant) => PermissionGrantSchema.parse(grant))
    .some(
      (grant) =>
        grant.projectId === input.projectId &&
        grant.contributorId === contributor.id &&
        grant.operation === operation &&
        scopeMatches(grant.scope, scope, input.projectId)
    );

  if (!permitted) {
    return { authorized: false, reason: "permission_required" };
  }

  return {
    authorized: true,
    mode: resolveContributionMode(input),
  };
}

export type CommitDirectContributionInput = AuthorizeContributionInput & {
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  branchId: string;
  revisionId: string;
  expectedHeadRevisionId: string;
  changeSet: ChangeSet;
  createdAt: string;
  message?: string;
};

export function commitDirectContribution(
  input: CommitDirectContributionInput
): CommitChangeSetResult {
  const authorization = authorizeContribution(input);
  if (!authorization.authorized) {
    throw new Error("contribution requires permission");
  }
  if (authorization.mode !== "direct") {
    throw new Error("contribution requires proposal");
  }

  const branch = input.graph.branches[input.branchId];
  if (branch === undefined) {
    throw new Error(`branch not found: ${input.branchId}`);
  }
  if (branch.kind !== "workspace" || branch.canonical) {
    throw new Error("direct contribution requires a non-canonical workspace");
  }

  if (input.changeSet.changes.some((change) => change.kind !== input.operation)) {
    throw new Error("direct contribution ChangeSet must use one authorized operation");
  }

  return commitChangeSet({
    graph: input.graph,
    manuscript: input.manuscript,
    branchId: input.branchId,
    revisionId: input.revisionId,
    expectedHeadRevisionId: input.expectedHeadRevisionId,
    changeSet: input.changeSet,
    author: { id: input.contributor.id },
    createdAt: input.createdAt,
    message: input.message,
  });
}
