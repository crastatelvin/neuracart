'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { ErrorBanner, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateIST } from '@/lib/format';

type AskResult = {
  answer: string;
  sql: string | null;
  rows: unknown[];
  usedFallback: boolean;
};

type JobLog = {
  id: string;
  feature: string;
  model: string | null;
  status: 'ok' | 'fallback' | 'error';
  latencyMs: number;
  detail: string | null;
  createdAt: string;
};

type BackfillResult = {
  updated: number;
  skipped: boolean;
};

export default function AiConsolePage() {
  const toast = useToast();

  // ——— ask the data ———
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<AskResult | null>(null);

  // ——— notes digest ———
  const [notes, setNotes] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // ——— embeddings ———
  const [backfilling, setBackfilling] = useState(false);

  // ——— telemetry ———
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobs, setJobs] = useState<JobLog[]>([]);
  const [jobsError, setJobsError] = useState('');

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError('');
    try {
      setJobs(await api<JobLog[]>('/ai/admin/jobs', { redirectOnUnauthorized: false }));
    } catch (caught) {
      setJobsError(caught instanceof Error ? caught.message : 'Could not load AI telemetry.');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const ask = async () => {
    if (question.trim().length < 3 || asking) return;
    setAsking(true);
    setAskResult(null);
    try {
      const result = await api<AskResult>('/ai/admin/ask', {
        method: 'POST',
        body: { question: question.trim() },
        redirectOnUnauthorized: false,
      });
      setAskResult(result);
      void loadJobs();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'The AI console hit an error.');
    } finally {
      setAsking(false);
    }
  };

  const summarize = async () => {
    const list = notes
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length === 0 || summarizing) return;
    setSummarizing(true);
    setSummary(null);
    try {
      const result = await api<{ summary: string }>('/ai/admin/summarize', {
        method: 'POST',
        body: { notes: list },
        redirectOnUnauthorized: false,
      });
      setSummary(result.summary);
      void loadJobs();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not summarise the notes.');
    } finally {
      setSummarizing(false);
    }
  };

  const backfill = async () => {
    if (backfilling) return;
    setBackfilling(true);
    try {
      const result = await api<BackfillResult>('/ai/admin/embeddings-backfill', {
        method: 'POST',
        redirectOnUnauthorized: false,
      });
      if (result.skipped) {
        toast.info('The Gemini key is not configured, so embeddings were skipped.');
      } else {
        toast.success(`Embeddings refreshed for ${result.updated} products.`);
      }
      void loadJobs();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'The embeddings job failed.');
    } finally {
      setBackfilling(false);
    }
  };

  const rowCells = (row: unknown): string[] => {
    if (typeof row !== 'object' || row === null) return [String(row)];
    return Object.values(row as Record<string, unknown>).map((value) =>
      value === null || value === undefined ? '—' : String(value),
    );
  };

  return (
    <main className="page">
      <PageHeader
        title="AI console"
        subtitle="Ask the data in plain words, dig into AI usage, and keep product embeddings fresh"
        actions={
          <button
            className="btn btn-secondary"
            onClick={backfill}
            disabled={backfilling}
            type="button"
          >
            {backfilling ? <Spinner /> : <Icon name="refresh" size={14} />}
            Refresh embeddings
          </button>
        }
      />

      <div className="dashboard-grid" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="form-card">
            <div className="form-section" style={{ padding: 0 }}>
              <div className="form-section-header">
                <p className="form-section-title">Ask the data</p>
                <p className="form-section-text">
                  Natural-language questions run as read-only SQL. The AI answers from real rows —
                  never writes, never beyond the last 50 rows.
                </p>
              </div>
              <div className="field full">
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={question}
                    maxLength={500}
                    placeholder="e.g. Pending orders since yesterday, by status"
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void ask();
                    }}
                  />
                  <button className="btn btn-primary" onClick={ask} disabled={asking || question.trim().length < 3} type="button">
                    {asking ? <Spinner /> : <Icon name="sparkles" size={14} />}
                    Ask
                  </button>
                </div>
              </div>
              {askResult ? (
                <div className="ai-answer">
                  <p className="cell-main" style={{ fontWeight: 700 }}>{askResult.answer}</p>
                  {askResult.sql ? (
                    <pre className="ai-sql">{askResult.sql}</pre>
                  ) : null}
                  {askResult.rows.length > 0 ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {askResult.rows.length > 0 && typeof askResult.rows[0] === 'object' && askResult.rows[0] !== null
                              ? Object.keys(askResult.rows[0] as Record<string, unknown>).map((key) => (
                                  <th key={key}>{key}</th>
                                ))
                              : <th>value</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {askResult.rows.slice(0, 20).map((row, index) => (
                            <tr key={index}>
                              {rowCells(row).map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {askResult.usedFallback ? (
                    <p className="cell-sub">
                      Offline mode — the Gemini key is not configured, so you got the deterministic
                      snapshot. Every other guardrail still applies.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="form-card">
            <div className="form-section" style={{ padding: 0 }}>
              <div className="form-section-header">
                <p className="form-section-title">Digest store notes</p>
                <p className="form-section-text">One note per line — the AI condenses them into a short digest for you.</p>
              </div>
              <div className="field full">
                <textarea
                  className="textarea"
                  rows={5}
                  value={notes}
                  placeholder={'Banana stock runs low by evening.\nTwo orders delayed due to rain.'}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={summarize} disabled={summarizing || notes.trim().length < 2} type="button">
                  {summarizing ? <Spinner /> : <Icon name="sparkles" size={14} />}
                  Summarise
                </button>
                {summary ? <p className="cell-main" style={{ flex: 1, margin: 0 }}>{summary}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="form-card">
            <div className="form-section" style={{ padding: 0 }}>
              <div className="form-section-header">
                <p className="form-section-title">AI health — last {jobs.length} calls</p>
                <p className="form-section-text">Every AI touchpoint is logged: feature, outcome, model, latency.</p>
              </div>
              {jobsLoading ? <Spinner /> : jobsError ? (
                <ErrorBanner message={jobsError} />
              ) : jobs.length === 0 ? (
                <p className="cell-sub">No AI calls yet. Ask the data to generate the first log.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Status</th>
                        <th className="num">Latency</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 12).map((job) => (
                        <tr key={job.id}>
                          <td className="cell-main">{job.feature}</td>
                          <td>
                            <span
                              style={{
                                color: job.status === 'ok' ? 'var(--color-success, #15803D)' : job.status === 'fallback' ? '#B45309' : '#DC2626',
                                fontWeight: 700,
                              }}
                            >
                              {job.status}
                            </span>
                            {job.model ? <div className="cell-sub">{job.model}</div> : null}
                          </td>
                          <td className="num">{job.latencyMs}ms</td>
                          <td className="cell-sub">{formatDateIST(job.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="form-card">
            <div className="form-section" style={{ padding: 0 }}>
              <div className="form-section-header">
                <p className="form-section-title">How it runs</p>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                <li className="cell-sub">The Gemini free tier powers chat, matching, and drafts when GEMINI_API_KEY is set.</li>
                <li className="cell-sub">Without a key, every feature keeps a deterministic fallback — the console stays usable.</li>
                <li className="cell-sub">Token buckets, 429 backoff and a circuit breaker protect the free-tier quota.</li>
                <li className="cell-sub">“Ask the data” is read-only SELECTs, capped at 50 rows.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
