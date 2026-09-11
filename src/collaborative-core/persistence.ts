import { z } from "zod";
import {
  ContentVersionSchema,
  LiteraryManuscriptSchema,
  type ContentVersion,
  type LiteraryManuscript,
} from "./index.js";
import { TaskSchema, type Task } from "./collaboration.js";
import {
  IntegrationSchema,
  ProposalSchema,
  ReviewDecisionSchema,
  type Integration,
  type Proposal,
  type ReviewDecision,
} from "./proposal.js";
import {
  ChangeSetSchema,
  RevisionGraphSchema,
  RevisionSchema,
  WorkBranchSchema,
  type ChangeSet,
  type CommitChangeSetResult,
  type Revision,
  type RevisionGraph,
  type WorkBranch,
} from "./versioning.js";

const IdSchema = z.string().trim().min(1);

export const ManuscriptSnapshotSchema = z.object({
  projectId: IdSchema,
  revisionId: IdSchema,
  manuscript: LiteraryManuscriptSchema,
  materializedAt: z.string().datetime(),
});
export type ManuscriptSnapshot = z.infer<typeof ManuscriptSnapshotSchema>;

export type InitializeCollaborativeCoreProjectInput = {
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  contentVersions?: ContentVersion[];
};

export type AdvanceBranchHeadInput = {
  projectId: string;
  branchId: string;
  expectedHeadRevisionId: string;
  nextHeadRevisionId: string;
};

export interface CollaborativeCoreStore {
  initializeProject(input: InitializeCollaborativeCoreProjectInput): Promise<void>;
  loadRevisionGraph(projectId: string): Promise<RevisionGraph | undefined>;
  loadRevision(projectId: string, revisionId: string): Promise<Revision | undefined>;
  loadChangeSet(projectId: string, changeSetId: string): Promise<ChangeSet | undefined>;
  resolveContentVersion(
    projectId: string,
    nodeId: string,
    version: number
  ): Promise<ContentVersion | undefined>;
  appendContentVersions(projectId: string, versions: ContentVersion[]): Promise<void>;
  appendChangeSet(projectId: string, changeSet: ChangeSet): Promise<void>;
  appendRevision(projectId: string, revision: Revision): Promise<void>;
  createBranch(projectId: string, branch: WorkBranch): Promise<void>;
  advanceBranchHead(input: AdvanceBranchHeadInput): Promise<void>;
  walkRevisionAncestors(projectId: string, revisionId: string): Promise<string[]>;
  materializeSnapshot(snapshot: ManuscriptSnapshot): Promise<void>;
  loadSnapshot(projectId: string, revisionId: string): Promise<ManuscriptSnapshot | undefined>;
  loadCurrentManuscript(
    projectId: string,
    branchId: string
  ): Promise<LiteraryManuscript | undefined>;
  loadManuscriptAtRevision(
    projectId: string,
    revisionId: string
  ): Promise<LiteraryManuscript | undefined>;
  saveTask(task: Task): Promise<void>;
  loadTask(projectId: string, taskId: string): Promise<Task | undefined>;
  saveProposal(proposal: Proposal): Promise<void>;
  loadProposal(projectId: string, proposalId: string): Promise<Proposal | undefined>;
  appendReviewDecisions(projectId: string, decisions: ReviewDecision[]): Promise<void>;
  loadReviewDecisions(projectId: string, proposalId: string): Promise<ReviewDecision[]>;
  saveIntegration(integration: Integration): Promise<void>;
  loadIntegration(
    projectId: string,
    integrationId: string
  ): Promise<Integration | undefined>;
}

export type PersistCommitInput = {
  projectId: string;
  expectedHeadRevisionId: string;
  commit: CommitChangeSetResult;
};

export async function persistCommit(
  store: CollaborativeCoreStore,
  input: PersistCommitInput
): Promise<void> {
  const graph = RevisionGraphSchema.parse(input.commit.graph);
  const revision = RevisionSchema.parse(input.commit.revision);
  if (graph.projectId !== input.projectId || revision.projectId !== input.projectId) {
    throw new Error("commit project does not match persistence project");
  }

  const changeSet = graph.changeSets[revision.changeSetId];
  if (changeSet === undefined) {
    throw new Error(`commit ChangeSet not found: ${revision.changeSetId}`);
  }
  const branch = graph.branches[revision.branchId];
  if (branch === undefined || branch.headRevisionId !== revision.id) {
    throw new Error("commit graph must expose the committed revision as branch head");
  }
  if (revision.parentIds[0] !== input.expectedHeadRevisionId) {
    throw new Error("commit first parent must match expected branch head");
  }

  const storedGraph = await store.loadRevisionGraph(input.projectId);
  if (storedGraph === undefined) {
    throw new Error(`project not found: ${input.projectId}`);
  }
  if (storedGraph.branches[branch.id] === undefined) {
    await store.createBranch(input.projectId, {
      ...branch,
      headRevisionId: input.expectedHeadRevisionId,
    });
  }

  await store.appendContentVersions(input.projectId, input.commit.contentVersions);
  await store.appendChangeSet(input.projectId, changeSet);
  await store.appendRevision(input.projectId, revision);
  await store.advanceBranchHead({
    projectId: input.projectId,
    branchId: revision.branchId,
    expectedHeadRevisionId: input.expectedHeadRevisionId,
    nextHeadRevisionId: revision.id,
  });
  await store.materializeSnapshot({
    projectId: input.projectId,
    revisionId: revision.id,
    manuscript: input.commit.manuscript,
    materializedAt: revision.createdAt,
  });
}

type ProjectState = {
  canonicalBranchId: string;
  revisions: Map<string, Revision>;
  changeSets: Map<string, ChangeSet>;
  branches: Map<string, WorkBranch>;
  contentVersions: Map<string, ContentVersion>;
  snapshots: Map<string, ManuscriptSnapshot>;
  tasks: Map<string, Task>;
  proposals: Map<string, Proposal>;
  reviewDecisions: Map<string, ReviewDecision>;
  integrations: Map<string, Integration>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function contentVersionKey(nodeId: string, version: number): string {
  return `${nodeId}:${version}`;
}

function reviewDecisionKey(proposalId: string, decisionId: string): string {
  return `${proposalId}:${decisionId}`;
}

function requireProject(
  projects: Map<string, ProjectState>,
  projectId: string
): ProjectState {
  const project = projects.get(projectId);
  if (project === undefined) {
    throw new Error(`project not found: ${projectId}`);
  }
  return project;
}

function buildGraph(projectId: string, project: ProjectState): RevisionGraph {
  return RevisionGraphSchema.parse({
    projectId,
    canonicalBranchId: project.canonicalBranchId,
    revisions: Object.fromEntries(project.revisions),
    changeSets: Object.fromEntries(project.changeSets),
    branches: Object.fromEntries(project.branches),
  });
}

function appendImmutable<T>(
  map: Map<string, T>,
  key: string,
  value: T,
  conflictMessage: string
): void {
  const current = map.get(key);
  if (current === undefined) {
    map.set(key, clone(value));
    return;
  }
  if (!sameValue(current, value)) {
    throw new Error(conflictMessage);
  }
}

export function createInMemoryCollaborativeCoreStore(): CollaborativeCoreStore {
  const projects = new Map<string, ProjectState>();

  return {
    async initializeProject(input) {
      const graph = RevisionGraphSchema.parse(input.graph);
      const manuscript = LiteraryManuscriptSchema.parse(input.manuscript);
      if (projects.has(graph.projectId)) {
        throw new Error(`project already exists: ${graph.projectId}`);
      }

      const canonical = graph.branches[graph.canonicalBranchId];
      if (canonical === undefined) {
        throw new Error("canonical branch not found");
      }
      const canonicalRevision = graph.revisions[canonical.headRevisionId];
      if (canonicalRevision === undefined) {
        throw new Error("canonical revision not found");
      }

      const project: ProjectState = {
        canonicalBranchId: graph.canonicalBranchId,
        revisions: new Map(
          Object.entries(graph.revisions).map(([id, revision]) => [id, clone(revision)])
        ),
        changeSets: new Map(
          Object.entries(graph.changeSets).map(([id, changeSet]) => [id, clone(changeSet)])
        ),
        branches: new Map(
          Object.entries(graph.branches).map(([id, branch]) => [id, clone(branch)])
        ),
        contentVersions: new Map(),
        snapshots: new Map(),
        tasks: new Map(),
        proposals: new Map(),
        reviewDecisions: new Map(),
        integrations: new Map(),
      };

      for (const version of input.contentVersions ?? []) {
        const parsed = ContentVersionSchema.parse(version);
        appendImmutable(
          project.contentVersions,
          contentVersionKey(parsed.nodeId, parsed.version),
          parsed,
          `immutable content version conflict: ${parsed.nodeId}@${parsed.version}`
        );
      }

      const snapshot = ManuscriptSnapshotSchema.parse({
        projectId: graph.projectId,
        revisionId: canonical.headRevisionId,
        manuscript,
        materializedAt: canonicalRevision.createdAt,
      });
      project.snapshots.set(snapshot.revisionId, clone(snapshot));
      projects.set(graph.projectId, project);
    },

    async loadRevisionGraph(projectId) {
      const project = projects.get(projectId);
      return project === undefined ? undefined : clone(buildGraph(projectId, project));
    },

    async loadRevision(projectId, revisionId) {
      const project = projects.get(projectId);
      const revision = project?.revisions.get(revisionId);
      return revision === undefined ? undefined : clone(revision);
    },

    async loadChangeSet(projectId, changeSetId) {
      const project = projects.get(projectId);
      const changeSet = project?.changeSets.get(changeSetId);
      return changeSet === undefined ? undefined : clone(changeSet);
    },

    async resolveContentVersion(projectId, nodeId, version) {
      const project = projects.get(projectId);
      const content = project?.contentVersions.get(contentVersionKey(nodeId, version));
      return content === undefined ? undefined : clone(content);
    },

    async appendContentVersions(projectId, versions) {
      const project = requireProject(projects, projectId);
      for (const value of versions) {
        const parsed = ContentVersionSchema.parse(value);
        appendImmutable(
          project.contentVersions,
          contentVersionKey(parsed.nodeId, parsed.version),
          parsed,
          `immutable content version conflict: ${parsed.nodeId}@${parsed.version}`
        );
      }
    },

    async appendChangeSet(projectId, changeSet) {
      const project = requireProject(projects, projectId);
      const parsed = ChangeSetSchema.parse(changeSet);
      appendImmutable(
        project.changeSets,
        parsed.id,
        parsed,
        `immutable ChangeSet conflict: ${parsed.id}`
      );
    },

    async appendRevision(projectId, revision) {
      const project = requireProject(projects, projectId);
      const parsed = RevisionSchema.parse(revision);
      if (parsed.projectId !== projectId) {
        throw new Error("revision project does not match persistence project");
      }
      if (!project.changeSets.has(parsed.changeSetId)) {
        throw new Error(`ChangeSet not found: ${parsed.changeSetId}`);
      }
      for (const parentId of parsed.parentIds) {
        if (!project.revisions.has(parentId)) {
          throw new Error(`revision parent not found: ${parentId}`);
        }
      }
      appendImmutable(
        project.revisions,
        parsed.id,
        parsed,
        `immutable revision conflict: ${parsed.id}`
      );
    },

    async createBranch(projectId, branch) {
      const project = requireProject(projects, projectId);
      const parsed = WorkBranchSchema.parse(branch);
      if (!project.revisions.has(parsed.headRevisionId)) {
        throw new Error(`revision not found: ${parsed.headRevisionId}`);
      }
      const current = project.branches.get(parsed.id);
      if (current !== undefined) {
        if (!sameValue(current, parsed)) {
          throw new Error(`branch already exists: ${parsed.id}`);
        }
        return;
      }
      if (parsed.canonical) {
        throw new Error("additional branches cannot become canonical through createBranch");
      }
      project.branches.set(parsed.id, clone(parsed));
    },

    async advanceBranchHead(input) {
      const project = requireProject(projects, input.projectId);
      const branch = project.branches.get(input.branchId);
      if (branch === undefined) {
        throw new Error(`branch not found: ${input.branchId}`);
      }
      if (branch.headRevisionId !== input.expectedHeadRevisionId) {
        throw new Error(
          `branch head mismatch: expected ${input.expectedHeadRevisionId}, got ${branch.headRevisionId}`
        );
      }
      const revision = project.revisions.get(input.nextHeadRevisionId);
      if (revision === undefined) {
        throw new Error(`revision not found: ${input.nextHeadRevisionId}`);
      }
      if (input.nextHeadRevisionId !== input.expectedHeadRevisionId) {
        if (revision.branchId !== branch.id) {
          throw new Error("next revision must belong to the branch being advanced");
        }
        if (revision.parentIds[0] !== input.expectedHeadRevisionId) {
          throw new Error("next revision first parent must match expected branch head");
        }
      }
      project.branches.set(
        branch.id,
        WorkBranchSchema.parse({ ...branch, headRevisionId: input.nextHeadRevisionId })
      );
    },

    async walkRevisionAncestors(projectId, revisionId) {
      const project = requireProject(projects, projectId);
      if (!project.revisions.has(revisionId)) {
        throw new Error(`revision not found: ${revisionId}`);
      }
      const result: string[] = [];
      const seen = new Set<string>();
      const queue = [...(project.revisions.get(revisionId)?.parentIds ?? [])];
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        if (seen.has(parentId)) continue;
        seen.add(parentId);
        result.push(parentId);
        const parent = project.revisions.get(parentId);
        if (parent !== undefined) queue.push(...parent.parentIds);
      }
      return result;
    },

    async materializeSnapshot(snapshot) {
      const parsed = ManuscriptSnapshotSchema.parse(snapshot);
      const project = requireProject(projects, parsed.projectId);
      if (!project.revisions.has(parsed.revisionId)) {
        throw new Error(`revision not found: ${parsed.revisionId}`);
      }
      project.snapshots.set(parsed.revisionId, clone(parsed));
    },

    async loadSnapshot(projectId, revisionId) {
      const project = projects.get(projectId);
      const snapshot = project?.snapshots.get(revisionId);
      return snapshot === undefined ? undefined : clone(snapshot);
    },

    async loadCurrentManuscript(projectId, branchId) {
      const project = projects.get(projectId);
      const branch = project?.branches.get(branchId);
      if (project === undefined || branch === undefined) return undefined;
      const snapshot = project.snapshots.get(branch.headRevisionId);
      return snapshot === undefined ? undefined : clone(snapshot.manuscript);
    },

    async loadManuscriptAtRevision(projectId, revisionId) {
      const project = projects.get(projectId);
      const snapshot = project?.snapshots.get(revisionId);
      return snapshot === undefined ? undefined : clone(snapshot.manuscript);
    },

    async saveTask(task) {
      const parsed = TaskSchema.parse(task);
      const project = requireProject(projects, parsed.projectId);
      project.tasks.set(parsed.id, clone(parsed));
    },

    async loadTask(projectId, taskId) {
      const project = projects.get(projectId);
      const task = project?.tasks.get(taskId);
      return task === undefined ? undefined : clone(task);
    },

    async saveProposal(proposal) {
      const parsed = ProposalSchema.parse(proposal);
      const project = requireProject(projects, parsed.projectId);
      project.proposals.set(parsed.id, clone(parsed));
    },

    async loadProposal(projectId, proposalId) {
      const project = projects.get(projectId);
      const proposal = project?.proposals.get(proposalId);
      return proposal === undefined ? undefined : clone(proposal);
    },

    async appendReviewDecisions(projectId, decisions) {
      const project = requireProject(projects, projectId);
      for (const value of decisions) {
        const parsed = ReviewDecisionSchema.parse(value);
        appendImmutable(
          project.reviewDecisions,
          reviewDecisionKey(parsed.proposalId, parsed.id),
          parsed,
          `immutable review decision conflict: ${parsed.id}`
        );
      }
    },

    async loadReviewDecisions(projectId, proposalId) {
      const project = projects.get(projectId);
      if (project === undefined) return [];
      return [...project.reviewDecisions.values()]
        .filter((decision) => decision.proposalId === proposalId)
        .map((decision) => clone(decision));
    },

    async saveIntegration(integration) {
      const parsed = IntegrationSchema.parse(integration);
      const proposalProjectId = [...projects.entries()].find(([, project]) =>
        project.proposals.has(parsed.proposalId)
      )?.[0];
      if (proposalProjectId === undefined) {
        throw new Error(`proposal not found for integration: ${parsed.proposalId}`);
      }
      const project = requireProject(projects, proposalProjectId);
      appendImmutable(
        project.integrations,
        parsed.id,
        parsed,
        `immutable integration conflict: ${parsed.id}`
      );
    },

    async loadIntegration(projectId, integrationId) {
      const project = projects.get(projectId);
      const integration = project?.integrations.get(integrationId);
      return integration === undefined ? undefined : clone(integration);
    },
  };
}
