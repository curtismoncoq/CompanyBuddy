import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { addSource, approveDecision, exportApprovedBook, importApprovedBook, type DecisionBook } from './decisions.js';

interface PortableBook extends DecisionBook {
  format: 'companybuddy.approved.v1';
}

const empty: DecisionBook = { sources: [], decisions: [] };

test('the reference source requires human approval before its portable handoff', async () => {
  const text = await readFile(new URL('../../examples/scenario1.json', import.meta.url), 'utf8');
  const candidates = await addSource(empty, { name: 'scenario1.json', text }, async () => {
    throw new Error('Structured sources must not need a model.');
  });
  assert.equal(candidates.decisions.length, 2);
  assert.equal(candidates.sources[0]?.actions.length, 3);
  assert.ok(candidates.decisions.every(item => item.approvedBy === null && item.approvedAt === null));
  assert.equal(importApprovedBook(empty, exportApprovedBook(candidates)).decisions.length, 0);
  const candidate = candidates.decisions[0];
  assert.ok(candidate);
  const approved = approveDecision(candidates, {
    id: candidate.id, title: candidate.title, description: candidate.description,
    scope: candidate.scope, dateConstraints: candidate.dateConstraints,
    sourceQuote: candidate.sourceQuote, approvedBy: 'Alex',
  });
  const portable = exportApprovedBook(approved);
  const imported = importApprovedBook(empty, portable);
  assert.equal(imported.decisions.length, 1);
  assert.equal(imported.decisions[0]?.approvedBy, 'Alex');
  assert.ok(imported.decisions[0]?.approvedAt);
  assert.equal(imported.decisions[0]?.sourceQuote, candidate.sourceQuote);
  assert.equal(imported.sources[0]?.text, text);
  assert.equal(imported.sources[0]?.actions.length, 3);
  assert.deepEqual(importApprovedBook(imported, portable), imported);

  const beforeRejectedImports = structuredClone(imported);
  const missing: PortableBook = JSON.parse(portable);
  missing.sources = [];
  assert.throws(() => importApprovedBook(imported, JSON.stringify(missing)));
  const unapproved: PortableBook = JSON.parse(portable);
  assert.ok(unapproved.decisions[0]);
  unapproved.decisions[0].approvedBy = null;
  unapproved.decisions[0].approvedAt = null;
  assert.throws(() => importApprovedBook(imported, JSON.stringify(unapproved)));
  const colliding: PortableBook = JSON.parse(portable);
  assert.ok(colliding.decisions[0]);
  colliding.decisions[0].description = 'Remplacer le contenu approuvé.';
  assert.throws(() => importApprovedBook(imported, JSON.stringify(colliding)));
  assert.deepEqual(imported, beforeRejectedImports);
});

test('escaped JSON evidence survives approval and portable import as original source text', async () => {
  const text = JSON.stringify({
    reunion: 'Compatibilité',
    decisions: [{ sujet: 'V1', description: 'Conserver "V1".\nNe pas désactiver.', valide_par: ['Alex'] }],
    actions_a_realiser: [],
  });
  const candidates = await addSource(empty, { name: 'escaped.json', text }, async () => []);
  const candidate = candidates.decisions[0];
  assert.ok(candidate);
  assert.equal(candidate.sourceQuote, 'Conserver \\"V1\\".\\nNe pas désactiver.');
  assert.ok(text.includes(candidate.sourceQuote));
  const approved = approveDecision(candidates, {
    id: candidate.id, title: candidate.title, description: candidate.description,
    scope: candidate.scope, dateConstraints: candidate.dateConstraints,
    sourceQuote: candidate.sourceQuote, approvedBy: 'Alex',
  });
  const imported = importApprovedBook(empty, exportApprovedBook(approved));
  assert.equal(imported.decisions[0]?.sourceQuote, candidate.sourceQuote);
  assert.ok(imported.sources[0]?.text.includes(candidate.sourceQuote));
});
