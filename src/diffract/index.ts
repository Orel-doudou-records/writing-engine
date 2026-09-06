import { z } from "zod";

export const DiffractiveReferenceSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1),
});

export type DiffractiveReference = z.infer<typeof DiffractiveReferenceSchema>;

export const DiffractiveFragmentSchema = z.object({
  statement: z.string().trim().min(1),
  refs: z.array(DiffractiveReferenceSchema).default([]),
});

export type DiffractiveFragment = z.infer<typeof DiffractiveFragmentSchema>;
export type DiffractiveFragmentInput = z.input<typeof DiffractiveFragmentSchema>;

export const ContextBlockSchema = z.object({
  ref: DiffractiveReferenceSchema,
  label: z.string().trim().min(1),
  text: z.string().trim().min(1),
});

export type ContextBlock = z.infer<typeof ContextBlockSchema>;

export const ExistingCutSchema = z.object({
  target: DiffractiveReferenceSchema,
  verdict: z.string().trim().min(1),
  cut: z.string().trim().min(1),
});

export type ExistingCut = z.infer<typeof ExistingCutSchema>;

export const VerdictSchema = z.enum([
  "integrate_now",
  "adapt_differently",
  "incubate",
  "archive",
  "discard",
]);

export type Verdict = z.infer<typeof VerdictSchema>;

export const Pass1Schema = z.object({
  refraction: z.array(z.string().min(1)).default([]),
});

export type Pass1 = z.infer<typeof Pass1Schema>;

export const RevealedDefaultSchema = z.object({
  default: z.string().min(1),
  priorCut: z.string().min(1).optional(),
});

export type RevealedDefault = z.infer<typeof RevealedDefaultSchema>;

export const Pass2Schema = z.object({
  namedPatterns: z.array(z.string().min(1)).default([]),
  revealedDefaults: z.array(RevealedDefaultSchema).default([]),
});

export type Pass2 = z.infer<typeof Pass2Schema>;

export const EntanglementSchema = z.object({
  name: z.string().min(1),
  cutIfIntegrated: z.string().min(1),
  becomesIntelligible: z.array(z.string().min(1)).default([]),
  becomesUnintelligible: z.array(z.string().min(1)).default([]),
});

export type Entanglement = z.infer<typeof EntanglementSchema>;

export const Pass3Schema = z.object({
  entanglements: z.array(EntanglementSchema).max(4).default([]),
});

export type Pass3 = z.infer<typeof Pass3Schema>;

export const DiffractiveCutSchema = z.object({
  cut: z.string().min(1),
  included: z.array(z.string().min(1)).default([]),
  excluded: z.array(z.string().min(1)).default([]),
  cutOfNonAdoption: z.array(z.string().min(1)).default([]),
});

export type DiffractiveCut = z.infer<typeof DiffractiveCutSchema>;

export const TradeoffSchema = z.object({
  path: z.string().min(1),
  effort: z.string().min(1),
  reversibility: z.string().min(1),
  leverage: z.string().min(1),
  distractionTax: z.string().min(1),
  verdict: VerdictSchema,
});

export type Tradeoff = z.infer<typeof TradeoffSchema>;

export const DiffractiveImpactSchema = z.object({
  target: DiffractiveReferenceSchema,
  impact: z.string().min(1),
});

export type DiffractiveImpact = z.infer<typeof DiffractiveImpactSchema>;

export const DiffractiveReadingSchema = z.object({
  id: z.string().min(1),
  fragment: DiffractiveFragmentSchema,
  pass1: Pass1Schema,
  pass2: Pass2Schema,
  pass3: Pass3Schema,
  pass4: DiffractiveCutSchema,
  verdict: VerdictSchema,
  verdictDetail: z.string().min(1),
  action: z.string().min(1),
  tradeoffs: z.array(TradeoffSchema).default([]),
  impacts: z.array(DiffractiveImpactSchema).default([]),
  createdAt: z.string().datetime(),
});

export type DiffractiveReading = z.infer<typeof DiffractiveReadingSchema>;

export interface CreateDiffractiveReadingInput {
  fragment: DiffractiveFragmentInput;
  pass1?: Partial<Pass1>;
  pass2?: Partial<Pass2>;
  pass3?: Partial<Pass3>;
  pass4: DiffractiveCut;
  verdict: Verdict;
  verdictDetail: string;
  action: string;
  tradeoffs?: Tradeoff[];
  impacts?: DiffractiveImpact[];
}

export function createDiffractiveReading(
  input: CreateDiffractiveReadingInput
): DiffractiveReading {
  return DiffractiveReadingSchema.parse({
    id: crypto.randomUUID(),
    fragment: input.fragment,
    pass1: { refraction: input.pass1?.refraction ?? [] },
    pass2: {
      namedPatterns: input.pass2?.namedPatterns ?? [],
      revealedDefaults: input.pass2?.revealedDefaults ?? [],
    },
    pass3: { entanglements: input.pass3?.entanglements ?? [] },
    pass4: input.pass4,
    verdict: input.verdict,
    verdictDetail: input.verdictDetail,
    action: input.action,
    tradeoffs: input.tradeoffs ?? [],
    impacts: input.impacts ?? [],
    createdAt: new Date().toISOString(),
  });
}

export const DiffractiveReadingRequestSchema = z
  .object({
    fragment: DiffractiveFragmentSchema,
    context: z.array(ContextBlockSchema).min(1),
    existingCuts: z.array(ExistingCutSchema).default([]),
  })
  .superRefine((request, ctx) => {
    const seen = new Set<string>();
    for (const block of request.context) {
      const key = referenceKey(block.ref);
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["context"],
          message: "context references must be unique",
        });
        return;
      }
      seen.add(key);
    }
  });

export type DiffractiveReadingRequest = z.infer<
  typeof DiffractiveReadingRequestSchema
>;
export type DiffractiveReadingRequestInput = z.input<
  typeof DiffractiveReadingRequestSchema
>;

const RawDiffractiveOutputSchema = z.object({
  pass1: Pass1Schema.default({ refraction: [] }),
  pass2: z
    .object({
      namedPatterns: z.array(z.string().min(1)).default([]),
      revealedDefaults: z
        .array(
          z.object({
            default: z.string().min(1),
            priorCut: z.string().min(1).optional().nullable(),
          })
        )
        .default([]),
    })
    .default({ namedPatterns: [], revealedDefaults: [] }),
  pass3: Pass3Schema.default({ entanglements: [] }),
  pass4: DiffractiveCutSchema,
  verdict: VerdictSchema,
  verdictDetail: z.string().min(1),
  action: z.string().min(1),
  tradeoffs: z.array(TradeoffSchema).default([]),
  impacts: z.array(DiffractiveImpactSchema).default([]),
});

export interface StructuredJsonClient {
  generateJson(prompt: string): Promise<unknown>;
}

export class DiffractiveCore {
  constructor(private readonly client: StructuredJsonClient) {}

  async read(input: DiffractiveReadingRequestInput): Promise<DiffractiveReading> {
    const request = parseRequest(input);
    const raw = RawDiffractiveOutputSchema.parse(
      await this.client.generateJson(buildDiffractivePrompt(request))
    );

    assertImpactTargetsWereProvided(request, raw.impacts);

    return createDiffractiveReading({
      fragment: request.fragment,
      pass1: raw.pass1,
      pass2: {
        namedPatterns: raw.pass2.namedPatterns,
        revealedDefaults: raw.pass2.revealedDefaults.map((item) => ({
          default: item.default,
          priorCut: item.priorCut ?? undefined,
        })),
      },
      pass3: raw.pass3,
      pass4: raw.pass4,
      verdict: raw.verdict,
      verdictDetail: raw.verdictDetail,
      action: raw.action,
      tradeoffs: raw.tradeoffs,
      impacts: raw.impacts,
    });
  }
}

export function createDiffractiveCore(
  client: StructuredJsonClient
): DiffractiveCore {
  return new DiffractiveCore(client);
}

export function buildDiffractivePrompt(request: DiffractiveReadingRequest): string {
  const allowedRefs = collectProvidedReferences(request)
    .map((ref) => `- ${formatReference(ref)}`)
    .join("\n");
  const context = request.context
    .map(
      (block) =>
        `### ${formatReference(block.ref)} ${block.label}\n${block.text}`
    )
    .join("\n\n");
  const cuts = request.existingCuts.length
    ? request.existingCuts
        .map(
          (cut) =>
            `- ${formatReference(cut.target)} | verdict ${cut.verdict} | ${cut.cut}`
        )
        .join("\n")
    : "- none";

  return `You are the domain-neutral Diffract reader in Writing Engine.

You read a proposed change through the supplied context, then read the context back through the proposal. Produce structured findings only. Do not expose hidden chain-of-thought.

## fragment
${request.fragment.statement}

## context
${context}

## existing cuts
${cuts}

## allowed impact targets
${allowedRefs}

## method
1. Pass 1, refraction: what becomes different or newly visible when the fragment is placed in this context.
2. Pass 2, defaults and patterns: what the fragment reveals as an existing pattern or previously invisible choice.
3. Pass 3, entanglements: at most four meaningful entanglements. Empty is better than fabricated insight.
4. Pass 4, cut: state what is included, excluded, and what non-adoption would itself exclude.

Then force one verdict: integrate_now, adapt_differently, incubate, archive, or discard. Do not answer "it depends". The action is a recommendation for later product governance, never an executable writer command.

Tradeoffs should include a path that does nothing and a path that adapts the proposal differently when those paths are meaningful. Compose with every existing cut. Do not silently contradict an existing cut.

Impacts may target only the exact references listed under allowed impact targets. Never invent an identifier. If there is no honest impact, return an empty array.

Return strict JSON with this shape:
{
  "pass1": { "refraction": ["string"] },
  "pass2": {
    "namedPatterns": ["string"],
    "revealedDefaults": [{ "default": "string", "priorCut": "string or null" }]
  },
  "pass3": {
    "entanglements": [{
      "name": "string",
      "cutIfIntegrated": "string",
      "becomesIntelligible": ["string"],
      "becomesUnintelligible": ["string"]
    }]
  },
  "pass4": {
    "cut": "string",
    "included": ["string"],
    "excluded": ["string"],
    "cutOfNonAdoption": ["string"]
  },
  "verdict": "integrate_now|adapt_differently|incubate|archive|discard",
  "verdictDetail": "string",
  "action": "string",
  "tradeoffs": [{
    "path": "string",
    "effort": "string",
    "reversibility": "string",
    "leverage": "string",
    "distractionTax": "string",
    "verdict": "integrate_now|adapt_differently|incubate|archive|discard"
  }],
  "impacts": [{
    "target": { "kind": "string", "id": "string" },
    "impact": "string"
  }]
}`;
}

function parseRequest(
  input: DiffractiveReadingRequestInput
): DiffractiveReadingRequest {
  const result = DiffractiveReadingRequestSchema.safeParse(input);
  if (result.success) return result.data;

  const duplicateIssue = result.error.issues.find(
    (issue) => issue.message === "context references must be unique"
  );
  if (duplicateIssue) {
    throw new Error(duplicateIssue.message);
  }

  throw result.error;
}

function assertImpactTargetsWereProvided(
  request: DiffractiveReadingRequest,
  impacts: DiffractiveImpact[]
): void {
  const allowed = new Set(
    collectProvidedReferences(request).map(referenceKey)
  );

  for (const impact of impacts) {
    const key = referenceKey(impact.target);
    if (!allowed.has(key)) {
      throw new Error(`unknown impact target ${key}`);
    }
  }
}

function collectProvidedReferences(
  request: DiffractiveReadingRequest
): DiffractiveReference[] {
  const refs = [
    ...request.fragment.refs,
    ...request.context.map((block) => block.ref),
    ...request.existingCuts.map((cut) => cut.target),
  ];
  const unique = new Map<string, DiffractiveReference>();
  for (const ref of refs) unique.set(referenceKey(ref), ref);
  return [...unique.values()];
}

function referenceKey(ref: DiffractiveReference): string {
  return `${ref.kind}:${ref.id}`;
}

function formatReference(ref: DiffractiveReference): string {
  return `[${referenceKey(ref)}]`;
}
