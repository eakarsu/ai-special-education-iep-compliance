// Pure list filtering, export, and deterministic operational insights over
// workflow_cases. Compliance operations only — no diagnosis or clinical use.
// No provider calls: every insight is a labelled deterministic fallback.
const FALLBACK_LABEL = 'Deterministic fallback — not AI-generated';

function textOf(row) {
  return [row.reference, row.subject, row.owner, row.state, row.risk, row.workflow_id, JSON.stringify(row.payload ?? '')].join(' ').toLowerCase();
}

export function filterCases(rows, query = {}) {
  const q = String(query.q || '').trim().toLowerCase();
  const state = String(query.state || '').trim();
  const risk = String(query.risk || '').trim();
  return (rows || []).filter((row) => {
    if (q && !textOf(row).includes(q)) return false;
    if (state && row.state !== state) return false;
    if (risk && row.risk !== risk) return false;
    return true;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function casesToCSV(rows) {
  const columns = ['id', 'reference', 'subject', 'workflow_id', 'owner', 'state', 'risk', 'due_date', 'amount'];
  const lines = [columns.join(',')];
  for (const row of rows || []) lines.push(columns.map((col) => csvCell(row[col])).join(','));
  return lines.join('\n') + '\n';
}

export function buildCaseInsights(rows, now = new Date()) {
  const list = rows || [];
  const open = list.filter((r) => !['approved', 'closed'].includes(r.state));
  const attention = list.filter((r) => ['High', 'Critical'].includes(r.risk) || ['review', 'analyzing'].includes(r.state));
  const overdue = open.filter((r) => r.due_date && new Date(r.due_date) < now);
  const byState = {};
  const byWorkflow = {};
  for (const r of list) { byState[r.state] = (byState[r.state] || 0) + 1; byWorkflow[r.workflow_id] = (byWorkflow[r.workflow_id] || 0) + 1; }
  const base = { aiGenerated: false, source: 'deterministic-fallback', label: FALLBACK_LABEL };
  return {
    ...base,
    recordCount: list.length,
    insights: [
      { ...base, id: 'timeline-triage', title: 'IEP timeline triage', summary: `${overdue.length} open cases are past their recorded due date and ${attention.length} need compliance review.`, metrics: [{ label: 'Total cases', value: list.length }, { label: 'Open cases', value: open.length }, { label: 'Need attention', value: attention.length }, { label: 'Overdue open', value: overdue.length }], items: overdue.slice(0, 5).map((r) => ({ reference: r.reference, state: r.state, risk: r.risk, dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null })) },
      { ...base, id: 'workload-distribution', title: 'Compliance workload distribution', summary: 'Counts by workflow state show where evaluation, review, and corrective follow-up are concentrated; zero-count states are preserved.', metrics: Object.entries(byState).map(([label, value]) => ({ label: `State: ${label}`, value })).concat([{ label: 'Distinct workflows', value: Object.keys(byWorkflow).length }]), items: Object.entries(byWorkflow).map(([workflow, count]) => ({ workflow, count })) },
      { ...base, id: 'attention-queue', title: 'Attention queue summary', summary: attention.length ? 'High/critical-risk and in-review cases form the operational attention queue for accountable owners.' : 'No cases currently meet the attention criteria; the empty queue is shown as recorded.', metrics: [{ label: 'Attention cases', value: attention.length }, { label: 'High risk', value: list.filter((r) => r.risk === 'High').length }, { label: 'Critical risk', value: list.filter((r) => r.risk === 'Critical').length }, { label: 'In review', value: list.filter((r) => r.state === 'review').length }], items: attention.slice(0, 5).map((r) => ({ reference: r.reference, state: r.state, risk: r.risk, owner: r.owner })) },
    ],
  };
}
