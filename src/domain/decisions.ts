import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  ApprovalInput,
  Decision,
  ExtractedDecision,
  SourceDocument,
} from '../shared/contracts.js';

export interface DecisionBook {
  sources: SourceDocument[];
  decisions: Decision[];
}

const nonempty = z.string().refine((value) => value.trim().length > 0, {
  message: 'Renseignez un texte non vide.',
});
const timestamp = z.string().datetime({
  offset: true,
  message: 'Indiquez une date et une heure ISO 8601 valides, avec le fuseau horaire.',
});
const extractedShape = {
  title: nonempty,
  description: nonempty,
  scope: z.string(),
  dateConstraints: z.string(),
  sourceQuote: nonempty,
};
const extractedSchema = z.object(extractedShape).strict();
const sourceSchema = z.object({
  id: nonempty,
  name: nonempty,
  text: nonempty,
  importedAt: timestamp,
  actions: z.array(z.object({ task: nonempty, assignee: nonempty }).strict()),
}).strict();
const decisionSchema = z.object({
  ...extractedShape,
  id: nonempty,
  sourceId: nonempty,
  approvedBy: nonempty.nullable(),
  approvedAt: timestamp.nullable(),
}).strict();
const bookSchema = z.object({
  sources: z.array(sourceSchema),
  decisions: z.array(decisionSchema),
});
const portableSchema = bookSchema.extend({
  format: z.literal('companybuddy.approved.v1'),
}).strict();
const referenceSchema = z.object({
  reunion: nonempty,
  decisions: z.array(z.object({
    sujet: nonempty,
    description: nonempty,
    valide_par: z.array(nonempty).optional(),
    scope: z.string().optional(),
    dateConstraints: z.string().optional(),
  })),
  actions_a_realiser: z.array(z.object({
    tache: nonempty,
    assigne_a: nonempty,
  })),
});

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  if (!issue) throw new Error(`${label} : données invalides.`);
  const field = issue.path.length ? issue.path.join('.') : 'document';
  let message = issue.message;
  if (issue.code === 'invalid_type') {
    message = issue.received === 'undefined'
      ? 'Ce champ est obligatoire.'
      : 'Le type de cette valeur est incorrect.';
  } else if (issue.code === 'invalid_literal') {
    message = `La valeur attendue est ${JSON.stringify(issue.expected)}.`;
  } else if (issue.code === 'unrecognized_keys') {
    message = `Retirez les champs non reconnus : ${issue.keys.join(', ')}.`;
  }
  throw new Error(`${label} : ${field} — ${message}`);
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} : JSON illisible. Vérifiez les guillemets, les virgules et les accolades.`);
  }
}

// Return an actual slice of the source, never a normalized replacement for it.
function evidenceQuote(text: string, quote: string): string {
  if (text.includes(quote)) return quote;
  const pattern = quote.trim().split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const match = pattern ? text.match(new RegExp(pattern, 'u')) : null;
  if (match) return match[0];
  throw new Error('Le passage cité est introuvable dans la source. Copiez un passage exact du document original.');
}

function assertBook(book: DecisionBook, approvedOnly = false): void {
  const ids = new Set<string>();
  const sources = new Map<string, SourceDocument>();
  for (const source of book.sources) {
    if (ids.has(source.id)) throw new Error(`Identifiant dupliqué : ${source.id}. Importez un fichier sans doublons.`);
    ids.add(source.id);
    sources.set(source.id, source);
  }
  for (const decision of book.decisions) {
    if (ids.has(decision.id)) throw new Error(`Identifiant dupliqué : ${decision.id}. Importez un fichier sans doublons.`);
    ids.add(decision.id);
    const source = sources.get(decision.sourceId);
    if (!source) throw new Error(`La source de « ${decision.title} » est absente. Importez aussi son document source.`);
    if ((decision.approvedBy === null) !== (decision.approvedAt === null)) {
      throw new Error(`L'approbation de « ${decision.title} » est incomplète : le nom et la date sont tous deux requis.`);
    }
    if (approvedOnly && decision.approvedBy === null) {
      throw new Error(`« ${decision.title} » n'est pas approuvée. Partagez uniquement les décisions explicitement approuvées.`);
    }
    // Persisted and portable evidence is already exact; do not silently rewrite it.
    if (!source.text.includes(decision.sourceQuote)) {
      throw new Error(`Le passage cité pour « ${decision.title} » ne figure pas exactement dans sa source.`);
    }
  }
}

export function restoreBook(value: unknown): DecisionBook {
  const book = parse(bookSchema, value, 'Livre de décisions invalide');
  assertBook(book);
  return book;
}

// JSON escape sequences belong to the original evidence too. Use the raw
// description value when its decoded form cannot occur literally in the file.
function jsonDescriptionQuote(text: string, description: string): string {
  try {
    return evidenceQuote(text, description);
  } catch {
    const strings = /"(?:[^"\\]|\\.)*"/gu;
    let token: RegExpExecArray | null;
    while ((token = strings.exec(text)) !== null) {
      if (JSON.parse(token[0]) !== 'description') continue;
      const rest = text.slice(strings.lastIndex);
      const value = /^\s*:\s*("(?:[^"\\]|\\.)*")/u.exec(rest);
      if (value?.[1] && JSON.parse(value[1]) === description) {
        return value[1].slice(1, -1);
      }
    }
    throw new Error('La description JSON ne peut pas être reliée à son passage source. Vérifiez le document.');
  }
}

function statedDates(description: string): string {
  const dateFact = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|aujourd['’]hui|demain|jusqu['’]|avant|après|échéance|délai)\b/iu;
  // Keep the wording (including minimum deadlines) rather than deriving an
  // effective date, an expiry, or permission to remove a restriction later.
  return description.split(/(?<=[.!?])\s+/u).filter((sentence) => dateFact.test(sentence)).join(' ');
}

export async function addSource(
  book: DecisionBook,
  input: { name: string; text: string },
  extract: (source: SourceDocument) => Promise<ExtractedDecision[]>,
): Promise<DecisionBook> {
  const current = restoreBook(book);
  const sourceInput = parse(z.object({ name: nonempty, text: nonempty }).strict(), input, 'Source invalide');
  const source: SourceDocument = {
    id: randomUUID(),
    name: sourceInput.name,
    text: sourceInput.text,
    importedAt: new Date().toISOString(),
    actions: [],
  };
  let extracted: ExtractedDecision[];
  if (/\.json$/iu.test(source.name.trim()) || source.text.trimStart().startsWith('{')) {
    const reference = parse(referenceSchema, parseJson(source.text, 'Source JSON invalide'), 'Source JSON invalide');
    source.actions = reference.actions_a_realiser.map((action) => ({
      task: action.tache,
      assignee: action.assigne_a,
    }));
    extracted = reference.decisions.map((decision) => ({
      title: decision.sujet,
      description: decision.description,
      scope: decision.scope ?? decision.description,
      dateConstraints: decision.dateConstraints ?? statedDates(decision.description),
      sourceQuote: jsonDescriptionQuote(source.text, decision.description),
    }));
  } else {
    // The extractor receives a separate object so it cannot replace the original
    // source or alter an existing book, even if extraction fails.
    extracted = parse(z.array(extractedSchema), await extract(sourceSchema.parse(source)), 'Extraction invalide');
  }
  const decisions = extracted.map((candidate): Decision => ({
    ...candidate,
    sourceQuote: evidenceQuote(source.text, candidate.sourceQuote),
    id: randomUUID(),
    sourceId: source.id,
    approvedBy: null,
    approvedAt: null,
  }));
  return restoreBook({
    sources: [...current.sources, source],
    decisions: [...current.decisions, ...decisions],
  });
}

export function approveDecision(book: DecisionBook, input: ApprovalInput): DecisionBook {
  const current = restoreBook(book);
  const approval = parse(z.object({
    ...extractedShape,
    id: nonempty,
    approvedBy: nonempty,
  }).strict(), input, 'Approbation invalide');
  const decision = current.decisions.find((item) => item.id === approval.id);
  if (!decision) throw new Error('Cette décision est introuvable. Sélectionnez une candidate existante.');
  if (decision.approvedBy !== null) throw new Error('Cette décision est déjà approuvée et ne peut pas être remplacée.');
  const source = current.sources.find((item) => item.id === decision.sourceId);
  if (!source) throw new Error('Le document source est introuvable. Réimportez la source avant de confirmer.');
  const approved: Decision = {
    ...decision,
    ...approval,
    approvedBy: approval.approvedBy.trim(),
    approvedAt: new Date().toISOString(),
    sourceQuote: evidenceQuote(source.text, approval.sourceQuote),
  };
  return {
    sources: current.sources,
    decisions: current.decisions.map((item) => item.id === approved.id ? approved : item),
  };
}

export function exportApprovedBook(book: DecisionBook): string {
  const current = restoreBook(book);
  const decisions = current.decisions.filter((decision) => decision.approvedBy !== null);
  const sourceIds = new Set(decisions.map((decision) => decision.sourceId));
  return JSON.stringify({
    format: 'companybuddy.approved.v1',
    sources: current.sources.filter((source) => sourceIds.has(source.id)),
    decisions,
  }, null, 2);
}

export function importApprovedBook(book: DecisionBook, text: string): DecisionBook {
  const current = restoreBook(book);
  const incoming = parse(portableSchema, parseJson(text, 'Fichier approuvé invalide'), 'Fichier approuvé invalide');
  assertBook(incoming, true);
  const referenced = new Set(incoming.decisions.map((decision) => decision.sourceId));
  if (incoming.sources.some((source) => !referenced.has(source.id))) {
    throw new Error('Le fichier contient une source sans décision approuvée. Exportez à nouveau le livre approuvé.');
  }
  const existing = new Map<string, SourceDocument | Decision>([
    ...current.sources.map((source): [string, SourceDocument] => [source.id, source]),
    ...current.decisions.map((decision): [string, Decision] => [decision.id, decision]),
  ]);
  for (const item of [...incoming.sources, ...incoming.decisions]) {
    const previous = existing.get(item.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
      throw new Error(`L'identifiant ${item.id} existe avec un contenu différent. Le fichier n'a pas été importé.`);
    }
  }
  return {
    sources: [...current.sources, ...incoming.sources.filter((source) => !existing.has(source.id))],
    decisions: [...current.decisions, ...incoming.decisions.filter((decision) => !existing.has(decision.id))],
  };
}
