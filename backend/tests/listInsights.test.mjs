import test from 'node:test';
import assert from 'node:assert/strict';
// Offline only: pure module, no provider keys are read or used.
delete process.env.OPENROUTER_API_KEY;
const { filterCases, casesToCSV, buildCaseInsights } = await import('../listInsights.mjs');

const rows = [
  { id: 1, reference: 'IEP-1', subject: 'Annual review case', workflow_id: 'annual-review', owner: 'Ana', state: 'review', risk: 'High', due_date: '2020-01-01', amount: 0, payload: {} },
  { id: 2, reference: 'IEP-2', subject: 'Closed case', workflow_id: 'child-find', owner: 'Ben', state: 'closed', risk: 'Low', due_date: '2999-01-01', amount: 10, payload: {} },
];

test('filterCases searches and filters the main list', () => {
  assert.equal(filterCases(rows, { q: 'annual' }).length, 1);
  assert.equal(filterCases(rows, { state: 'closed' })[0].reference, 'IEP-2');
  assert.equal(filterCases(rows, { risk: 'High' }).length, 1);
  assert.equal(filterCases(rows, { q: 'missing' }).length, 0);
});

test('casesToCSV preserves 0 values', () => {
  const csv = casesToCSV(rows);
  assert.ok(csv.startsWith('id,reference,subject,workflow_id,owner,state,risk,due_date,amount'));
  assert.ok(csv.split('\n')[1].endsWith(',0'));
});

test('buildCaseInsights is a labelled deterministic fallback preserving false/0/empty', () => {
  const out = buildCaseInsights(rows, new Date('2026-01-01'));
  assert.equal(out.aiGenerated, false);
  assert.equal(out.insights.length, 3);
  assert.ok(out.insights.every((i) => i.aiGenerated === false && i.label.includes('not AI-generated')));
  assert.equal(out.insights.find((i) => i.id === 'timeline-triage').metrics.find((m) => m.label === 'Overdue open').value, 1);
  const empty = buildCaseInsights([]);
  assert.equal(empty.recordCount, 0);
  assert.equal(empty.insights.find((i) => i.id === 'attention-queue').metrics.find((m) => m.label === 'Attention cases').value, 0);
});
