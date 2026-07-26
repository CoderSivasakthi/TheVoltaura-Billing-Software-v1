import { useState, useEffect, useCallback } from 'react';
import {
  Database, HardDrive, Upload, Download, Trash2, Shield, Server,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity,
  Clock, Zap, FolderOpen, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../services/api';

interface CheckResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  diagnostics?: {
    tables_created: number;
    customer_count: number;
    quotation_count: number;
    invoice_count: number;
    order_count: number;
    payment_count: number;
  };
  [key: string]: any;
}

interface HealthData {
  status: string;
  timestamp: string;
  totalLatencyMs: number;
  checks: {
    environment: CheckResult & { variables: Record<string, boolean>; missing: string[]; supabaseUrl: string; bucketName: string };
    database: CheckResult;
    storage: CheckResult & { bucketName: string };
    backendApi: CheckResult;
    authentication: CheckResult;
  };
}

interface CrudResults {
  ok: boolean;
  message?: string;
  results: {
    create: { ok: boolean; latencyMs: number } | null;
    read: { ok: boolean; latencyMs: number } | null;
    update: { ok: boolean; latencyMs: number; note?: string } | null;
    delete: { ok: boolean; latencyMs: number } | null;
  };
}

interface StorageResults {
  ok: boolean;
  message?: string;
  results: {
    upload: { ok: boolean; latencyMs: number; path?: string; sizeBytes?: number } | null;
    download: { ok: boolean; latencyMs: number; checksumMatch?: boolean } | null;
    delete: { ok: boolean; latencyMs: number } | null;
  };
}

interface FolderResult {
  ok: boolean;
  message?: string;
  results: { folder: string; ok: boolean; latencyMs: number }[];
}

interface DocumentResult {
  ok: boolean;
  message?: string;
  results: {
    generate: boolean;
    upload: boolean;
    dbMetadata: boolean;
    delete: boolean;
  };
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  created_at: string;
  file_name?: string;
}

// ── Status Indicator Component ────────────────────────────────────────
function StatusDot({ ok, loading }: { ok: boolean | null; loading?: boolean }) {
  if (loading) return <span className="sh-dot sh-dot-loading"><RefreshCw size={12} /></span>;
  if (ok === null) return <span className="sh-dot sh-dot-unknown" />;
  return <span className={`sh-dot ${ok ? 'sh-dot-ok' : 'sh-dot-fail'}`} />;
}

function StatusBadge({ ok, loading, label }: { ok: boolean | null; loading?: boolean; label?: string }) {
  if (loading) return <span className="sh-badge sh-badge-loading">{label || 'Testing...'}</span>;
  if (ok === null) return <span className="sh-badge sh-badge-unknown">{label || 'Not Tested'}</span>;
  return <span className={`sh-badge ${ok ? 'sh-badge-ok' : 'sh-badge-fail'}`}>{label || (ok ? 'Connected' : 'Failed')}</span>;
}

// ── Main Component ────────────────────────────────────────────────────
export default function SystemDiagnostics() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [crudResult, setCrudResult] = useState<CrudResults | null>(null);
  const [crudLoading, setCrudLoading] = useState(false);
  const [storageResult, setStorageResult] = useState<StorageResults | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [folderResult, setFolderResult] = useState<FolderResult | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [docResult, setDocResult] = useState<DocumentResult | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // ── Fetch health data ───────────────────────────────────────────────
  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await api('GET', '/api/system-health', undefined, true);
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (e) {
      setHealth(null);
    }
    setHealthLoading(false);
  }, []);

  const runCrudTest = useCallback(async () => {
    setCrudLoading(true);
    try {
      const data = await api('POST', '/api/system-health/test-crud', {}, true);
      setCrudResult(data);
    } catch (e) {
      setCrudResult({ ok: false, message: 'Request failed', results: { create: null, read: null, update: null, delete: null } });
    }
    setCrudLoading(false);
  }, []);

  const runStorageTest = useCallback(async () => {
    setStorageLoading(true);
    try {
      const data = await api('POST', '/api/system-health/test-storage', {}, true);
      setStorageResult(data);
    } catch (e) {
      setStorageResult({ ok: false, message: 'Request failed', results: { upload: null, download: null, delete: null } });
    }
    setStorageLoading(false);
  }, []);

  const runFolderTest = useCallback(async () => {
    setFolderLoading(true);
    try {
      const data = await api('POST', '/api/system-health/test-folders', {}, true);
      setFolderResult(data);
    } catch (e) {
      setFolderResult({ ok: false, message: 'Request failed', results: [] });
    }
    setFolderLoading(false);
  }, []);

  const runDocumentTest = useCallback(async () => {
    setDocLoading(true);
    try {
      const data = await api('POST', '/api/system-health/test-documents', {}, true);
      setDocResult(data);
    } catch (e) {
      setDocResult({ ok: false, message: 'Request failed', results: { generate: false, upload: false, dbMetadata: false, delete: false } });
    }
    setDocLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const data = await api('GET', '/api/system-health/recent-logs', undefined, true);
      setLogs(data || []);
    } catch { setLogs([]); }
  }, []);

  useEffect(() => {
    runHealthCheck();
    loadLogs();
  }, [runHealthCheck, loadLogs]);

  const runAll = async () => {
    await runHealthCheck();
    await runCrudTest();
    await runStorageTest();
    await runFolderTest();
    await runDocumentTest();
    await loadLogs();
  };

  const c = health?.checks;
  const getStatusColor = (ok: boolean) => ok ? '#22c55e' : '#ef4444';

  // ── Overall status ──────────────────────────────────────────────────
  const overallOk = health ? health.status === 'healthy' : null;

  return (
    <div className="sh-container">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sh-header">
        <div className="sh-header-left">
          <Activity size={24} />
          <div>
            <h1>System Health</h1>
            <p className="sh-subtitle">Database &amp; Storage Diagnostics</p>
          </div>
        </div>
        <div className="sh-header-right">
          {lastChecked && <span className="sh-last-checked">Last checked: {lastChecked}</span>}
          <button className="sh-btn sh-btn-primary" onClick={runAll} disabled={healthLoading}>
            <RefreshCw size={16} className={healthLoading ? 'spin' : ''} />
            Run All Tests
          </button>
        </div>
      </div>

      {/* ── Overall Status Banner ──────────────────────────────────── */}
      <div className={`sh-banner ${overallOk === null ? 'sh-banner-unknown' : overallOk ? 'sh-banner-ok' : 'sh-banner-fail'}`}>
        <div className="sh-banner-icon">
          {healthLoading ? <RefreshCw size={28} className="spin" /> : overallOk ? <CheckCircle2 size={28} /> : overallOk === null ? <AlertTriangle size={28} /> : <XCircle size={28} />}
        </div>
        <div className="sh-banner-text">
          <strong>{healthLoading ? 'Running Health Checks...' : overallOk ? 'All Systems Operational' : overallOk === null ? 'Awaiting Health Check' : 'System Issues Detected'}</strong>
          <span>{health ? `Response: ${health.totalLatencyMs}ms` : ''}</span>
        </div>
      </div>

      {/* ── Database Detail Card ───────────────────────────────────── */}
      {health && (
        <div className="sh-card">
          <div className="sh-card-header">
            <div className="sh-icon-box" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
              <Database size={20} />
            </div>
            <div className="sh-card-title">Database</div>
          </div>
          <div className="sh-card-body">
            <div className="sh-stat-row">
              <span className="sh-stat-label">Connection</span>
              <div className="sh-stat-value" style={{ color: getStatusColor(health.checks.database.ok) }}>
                {health.checks.database.message}
              </div>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Tables Created</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.tables_created || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Customers</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.customer_count || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Quotations</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.quotation_count || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Invoices</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.invoice_count || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Orders</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.order_count || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Payments</span>
              <span className="sh-stat-value">{health.checks.database.diagnostics?.payment_count || 0}</span>
            </div>
            <div className="sh-stat-row">
              <span className="sh-stat-label">Latency</span>
              <span className="sh-stat-value">{health.checks.database.latencyMs}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────────────────── */}
      <div className="sh-cards-grid">
        <div className="sh-card">
          <div className="sh-card-icon sh-icon-db"><Database size={20} /></div>
          <div className="sh-card-body">
            <span className="sh-card-label">Database</span>
            <StatusBadge ok={c?.database?.ok ?? null} loading={healthLoading} label={c?.database?.ok ? 'Connected' : c?.database?.message} />
          </div>
          {c?.database?.latencyMs != null && <span className="sh-card-latency">{c.database.latencyMs}ms</span>}
        </div>
        <div className="sh-card">
          <div className="sh-card-icon sh-icon-storage"><HardDrive size={20} /></div>
          <div className="sh-card-body">
            <span className="sh-card-label">Storage Bucket</span>
            <StatusBadge ok={c?.storage?.ok ?? null} loading={healthLoading} label={c?.storage?.ok ? c.storage.bucketName : c?.storage?.message} />
          </div>
          {c?.storage?.latencyMs != null && <span className="sh-card-latency">{c.storage.latencyMs}ms</span>}
        </div>
        <div className="sh-card">
          <div className="sh-card-icon sh-icon-auth"><Shield size={20} /></div>
          <div className="sh-card-body">
            <span className="sh-card-label">Authentication</span>
            <StatusBadge ok={c?.authentication?.ok ?? null} loading={healthLoading} label={c?.authentication?.ok ? 'Service Key Valid' : 'Not Configured'} />
          </div>
        </div>
        <div className="sh-card">
          <div className="sh-card-icon sh-icon-api"><Server size={20} /></div>
          <div className="sh-card-body">
            <span className="sh-card-label">Backend API</span>
            <StatusBadge ok={c?.backendApi?.ok ?? null} loading={healthLoading} label={c?.backendApi?.ok ? 'Running' : 'Offline'} />
          </div>
        </div>
      </div>

      {/* ── Detailed Sections ──────────────────────────────────────── */}
      <div className="sh-sections-grid">

        {/* Environment Variables */}
        <div className="sh-section">
          <div className="sh-section-header">
            <Zap size={18} />
            <h3>Environment Variables</h3>
            <StatusDot ok={c?.environment?.ok ?? null} loading={healthLoading} />
          </div>
          <div className="sh-section-body">
            {c?.environment?.variables && Object.entries(c.environment.variables).map(([key, ok]) => (
              <div key={key} className="sh-env-row">
                <StatusDot ok={ok} />
                <code>{key}</code>
                <span className={ok ? 'sh-env-ok' : 'sh-env-missing'}>{ok ? 'Loaded' : 'Missing'}</span>
              </div>
            ))}
            {c?.environment?.supabaseUrl && (
              <div className="sh-env-row sh-env-info">
                <span>Supabase URL:</span>
                <code>{c.environment.supabaseUrl}</code>
              </div>
            )}
            {c?.environment?.bucketName && (
              <div className="sh-env-row sh-env-info">
                <span>Bucket:</span>
                <code>{c.environment.bucketName}</code>
              </div>
            )}
            {c?.environment?.missing && c.environment.missing.length > 0 && (
              <div className="sh-error-box">
                <AlertTriangle size={14} />
                <span>Missing: {c.environment.missing.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Database CRUD Test */}
        <div className="sh-section">
          <div className="sh-section-header">
            <Database size={18} />
            <h3>Database & ERP CRUD Tests</h3>
          </div>
          <div className="sh-section-body" style={{ display: 'flex', gap: '10px' }}>
            <button className="sh-btn sh-btn-secondary" onClick={runCrudTest} disabled={crudLoading}>
              {crudLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
              {crudLoading ? 'Testing...' : 'Run Database CRUD Test'}
            </button>
            <button className="sh-btn sh-btn-secondary" onClick={runDocumentTest} disabled={docLoading}>
              {docLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
              {docLoading ? 'Testing...' : 'Run Full ERP Test'}
            </button>
          </div>
          <div className="sh-section-body" style={{ paddingTop: 0 }}>
            {crudResult && (
              <div className="sh-report-box">
                <div className="sh-report-divider">====================================</div>
                <div className="sh-report-title">SUPABASE DATABASE HEALTH CHECK</div>
                <div className="sh-report-divider">====================================</div>
                
                <div className="sh-report-row">
                  <span>Connection</span>
                  <span>✅ Connected</span>
                </div>
                
                {['create', 'read', 'update', 'delete'].map(op => {
                  const r = crudResult.results[op as keyof typeof crudResult.results];
                  return (
                    <div key={op} className="sh-report-row">
                      <span>{op.charAt(0).toUpperCase() + op.slice(1)}</span>
                      <span>{r?.ok ? '✅ Success' : '❌ Failed'}</span>
                    </div>
                  );
                })}

                <div className="sh-report-row">
                  <span>Database Response</span>
                  <span>{crudResult.results.create?.latencyMs || 0} ms</span>
                </div>

                <div className="sh-report-divider">====================================</div>
                <div className="sh-report-title">OVERALL STATUS</div>
                <div className="sh-report-row sh-report-overall">
                  <span>{crudResult.ok ? '✅ DATABASE IS WORKING' : '❌ DATABASE TEST FAILED'}</span>
                </div>
                <div className="sh-report-divider">====================================</div>
              </div>
            )}
            {crudResult && !crudResult.ok && crudResult.message && (
              <div className="sh-error-box" style={{ marginTop: '10px' }}>
                <XCircle size={14} />
                <div>
                  <strong>Failed:</strong> {crudResult.message}
                </div>
              </div>
            )}
            {docResult && (
              <div className="sh-report-box" style={{ marginTop: '10px' }}>
                <div className="sh-report-divider">====================================</div>
                <div className="sh-report-title">FULL ERP DOCUMENT TEST</div>
                <div className="sh-report-divider">====================================</div>
                
                <div className="sh-report-row">
                  <span>Generate PDF</span>
                  <span>{docResult.results.generate ? '✅ Success' : '❌ Failed'}</span>
                </div>
                <div className="sh-report-row">
                  <span>Upload to Storage</span>
                  <span>{docResult.results.upload ? '✅ Success' : '❌ Failed'}</span>
                </div>
                <div className="sh-report-row">
                  <span>DB Metadata Saved</span>
                  <span>{docResult.results.dbMetadata ? '✅ Success' : '❌ Failed'}</span>
                </div>
                <div className="sh-report-row">
                  <span>Cleanup Process</span>
                  <span>{docResult.results.delete ? '✅ Success' : '❌ Failed'}</span>
                </div>
              </div>
            )}
            {docResult && !docResult.ok && (
              <div className="sh-error-box" style={{ marginTop: '10px' }}>
                <XCircle size={14} />
                <div><strong>Failed:</strong> {docResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* Storage Upload/Download Test */}
        <div className="sh-section">
          <div className="sh-section-header">
            <Upload size={18} />
            <h3>Storage Upload &amp; Download Test</h3>
            <StatusDot ok={storageResult?.ok ?? null} loading={storageLoading} />
          </div>
          <div className="sh-section-body">
            <button className="sh-btn sh-btn-secondary" onClick={runStorageTest} disabled={storageLoading}>
              {storageLoading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
              {storageLoading ? 'Testing...' : 'Run Storage Test'}
            </button>
            {storageResult && (
              <div className="sh-test-results">
                {[
                  { key: 'upload', icon: Upload, label: 'Upload' },
                  { key: 'download', icon: Download, label: 'Download' },
                  { key: 'delete', icon: Trash2, label: 'Delete' },
                ].map(({ key, icon: Icon, label }) => {
                  const r = storageResult.results[key as keyof typeof storageResult.results];
                  return (
                    <div key={key} className="sh-test-row">
                      <StatusDot ok={r?.ok ?? null} />
                      <Icon size={14} />
                      <span className="sh-test-label">{label}</span>
                      {r?.ok ? <span className="sh-test-pass">Success</span> : r ? <span className="sh-test-fail">Failed</span> : <span className="sh-test-skip">Skipped</span>}
                      {r?.latencyMs != null && <span className="sh-test-latency">{r.latencyMs}ms</span>}
                    </div>
                  );
                })}
                {storageResult.results.download && (
                  <div className="sh-test-row">
                    <StatusDot ok={storageResult.results.download.checksumMatch ?? null} />
                    <FileText size={14} />
                    <span className="sh-test-label">Checksum</span>
                    {storageResult.results.download.checksumMatch ? <span className="sh-test-pass">Match</span> : <span className="sh-test-fail">Mismatch</span>}
                  </div>
                )}
              </div>
            )}
            {storageResult && !storageResult.ok && storageResult.message && (
              <div className="sh-error-box">
                <XCircle size={14} />
                <div>
                  <strong>Failed:</strong> {storageResult.message}
                  <div className="sh-error-fix">Create bucket <code>erp-documents</code> in Supabase Dashboard → Storage.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Folder Structure Test */}
        <div className="sh-section">
          <div className="sh-section-header">
            <FolderOpen size={18} />
            <h3>Storage Folder Test</h3>
            <StatusDot ok={folderResult?.ok ?? null} loading={folderLoading} />
          </div>
          <div className="sh-section-body">
            <button className="sh-btn sh-btn-secondary" onClick={runFolderTest} disabled={folderLoading}>
              {folderLoading ? <RefreshCw size={14} className="spin" /> : <FolderOpen size={14} />}
              {folderLoading ? 'Testing...' : 'Run Folder Test'}
            </button>
            {folderResult && (
              <div className="sh-test-results">
                {folderResult.results.map(r => (
                  <div key={r.folder} className="sh-test-row">
                    <StatusDot ok={r.ok} />
                    <FolderOpen size={14} />
                    <span className="sh-test-label">CUST-TEST/{r.folder}</span>
                    {r.ok ? <span className="sh-test-pass">Created</span> : <span className="sh-test-fail">Failed</span>}
                    {r.latencyMs != null && <span className="sh-test-latency">{r.latencyMs}ms</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── System Logs ────────────────────────────────────────────── */}
      <div className="sh-section sh-section-full">
        <div className="sh-section-header sh-section-header-click" onClick={() => { setLogsExpanded(!logsExpanded); if (!logsExpanded) loadLogs(); }}>
          <Clock size={18} />
          <h3>System Logs</h3>
          <span className="sh-log-count">{logs.length} events</span>
          {logsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        {logsExpanded && (
          <div className="sh-logs-body">
            {logs.length === 0 ? (
              <div className="sh-logs-empty">No audit logs found. Run operations to generate logs.</div>
            ) : (
              <div className="sh-logs-table-wrap">
                <table className="sh-logs-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Performed By</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 50).map(log => (
                      <tr key={log.id}>
                        <td><span className={`sh-log-action sh-log-${log.action}`}>{log.action}</span></td>
                        <td>{log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 16)})` : ''}</td>
                        <td>{log.performed_by || '—'}</td>
                        <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .sh-container { padding: 24px; max-width: 1200px; margin: 0 auto; }

        /* Header */
        .sh-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .sh-header-left { display: flex; align-items: center; gap: 12px; color: var(--text-primary, #1a1a2e); }
        .sh-header-left h1 { font-size: 22px; font-weight: 700; margin: 0; }
        .sh-subtitle { font-size: 13px; color: var(--text-secondary, #64748b); margin: 0; }
        .sh-header-right { display: flex; align-items: center; gap: 12px; }
        .sh-last-checked { font-size: 12px; color: var(--text-secondary, #64748b); }

        /* Buttons */
        .sh-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
        .sh-btn:disabled { opacity: .6; cursor: not-allowed; }
        .sh-btn-primary { background: #2563eb; color: #fff; }
        .sh-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .sh-btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
        .sh-btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

        /* Banner */
        .sh-banner { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; }
        .sh-banner-ok { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .sh-banner-fail { background: #fef2f2; border: 1px solid #fecaca; }
        .sh-banner-unknown { background: #fffbeb; border: 1px solid #fde68a; }
        .sh-banner-icon { display: flex; }
        .sh-banner-ok .sh-banner-icon { color: #16a34a; }
        .sh-banner-fail .sh-banner-icon { color: #dc2626; }
        .sh-banner-unknown .sh-banner-icon { color: #d97706; }
        .sh-banner-text { display: flex; flex-direction: column; gap: 2px; }
        .sh-banner-text strong { font-size: 15px; }
        .sh-banner-text span { font-size: 12px; color: var(--text-secondary, #64748b); }

        /* Cards Grid */
        .sh-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; margin-bottom: 20px; }
        .sh-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
        .sh-card-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sh-icon-db { background: #eff6ff; color: #2563eb; }
        .sh-icon-storage { background: #f0fdf4; color: #16a34a; }
        .sh-icon-auth { background: #faf5ff; color: #9333ea; }
        .sh-icon-api { background: #fff7ed; color: #ea580c; }
        .sh-card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
        .sh-card-label { font-size: 12px; font-weight: 600; color: var(--text-secondary, #64748b); text-transform: uppercase; letter-spacing: .5px; }
        .sh-card-latency { font-size: 11px; color: var(--text-secondary, #94a3b8); font-weight: 500; white-space: nowrap; }

        /* Status elements */
        .sh-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .sh-dot-ok { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,.4); }
        .sh-dot-fail { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,.4); }
        .sh-dot-unknown { background: #94a3b8; }
        .sh-dot-loading { color: #2563eb; animation: spin .8s linear infinite; display: inline-flex; }
        .sh-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .sh-badge-ok { background: #dcfce7; color: #15803d; }
        .sh-badge-fail { background: #fef2f2; color: #b91c1c; }
        .sh-badge-unknown { background: #f1f5f9; color: #64748b; }
        .sh-badge-loading { background: #eff6ff; color: #2563eb; }

        /* Sections Grid */
        .sh-sections-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .sh-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .sh-section-full { grid-column: 1 / -1; }
        .sh-section-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; color: var(--text-primary, #1a1a2e); }
        .sh-section-header h3 { font-size: 14px; font-weight: 600; margin: 0; flex: 1; }
        .sh-section-header-click { cursor: pointer; }
        .sh-section-header-click:hover { background: #f8fafc; }
        .sh-section-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }

        /* Env rows */
        .sh-env-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .sh-env-row code { font-size: 12px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }
        .sh-env-ok { color: #16a34a; font-weight: 500; }
        .sh-env-missing { color: #dc2626; font-weight: 500; }
        .sh-env-info { font-size: 12px; color: var(--text-secondary, #64748b); padding-left: 20px; }
        .sh-env-info code { font-size: 11px; }

        /* Test results */
        .sh-test-results { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; }
        .sh-test-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f8fafc; }
        .sh-test-row:last-child { border-bottom: none; }
        .sh-test-label { font-weight: 500; min-width: 80px; }
        .sh-test-pass { color: #16a34a; font-weight: 600; font-size: 12px; }
        .sh-test-fail { color: #dc2626; font-weight: 600; font-size: 12px; }
        .sh-test-skip { color: #94a3b8; font-size: 12px; }
        .sh-test-latency { font-size: 11px; color: #94a3b8; margin-left: auto; }
        .sh-test-note { font-size: 11px; color: #64748b; font-style: italic; }

        /* Error box */
        .sh-error-box { display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 13px; }
        .sh-error-fix { margin-top: 6px; font-size: 12px; color: #7f1d1d; }
        .sh-error-fix code { background: #fee2e2; padding: 1px 6px; border-radius: 3px; font-size: 11px; }

        /* Report Box */
        .sh-report-box { font-family: monospace; font-size: 13px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; color: #1e293b; margin-top: 10px; }
        .sh-report-divider { color: #94a3b8; margin: 4px 0; }
        .sh-report-title { font-weight: bold; margin: 8px 0; }
        .sh-report-row { display: flex; flex-direction: column; margin: 8px 0; }
        .sh-report-row span:first-child { font-weight: 600; color: #475569; }
        .sh-report-overall span { font-weight: bold; font-size: 14px; }

        /* Logs */
        .sh-log-count { font-size: 12px; color: var(--text-secondary, #94a3b8); font-weight: 400; }
        .sh-logs-body { padding: 0 18px 16px; }
        .sh-logs-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
        .sh-logs-table-wrap { overflow-x: auto; }
        .sh-logs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sh-logs-table th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
        .sh-logs-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .sh-log-action { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .sh-log-create { background: #dcfce7; color: #15803d; }
        .sh-log-update { background: #dbeafe; color: #1d4ed8; }
        .sh-log-delete { background: #fef2f2; color: #b91c1c; }
        .sh-log-upload { background: #f0fdf4; color: #16a34a; }
        .sh-log-download { background: #eff6ff; color: #2563eb; }
        .sh-log-login { background: #faf5ff; color: #9333ea; }
        .sh-log-logout { background: #fefce8; color: #a16207; }
        .sh-log-status_change { background: #fff7ed; color: #c2410c; }
        .sh-log-other { background: #f1f5f9; color: #64748b; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }

        @media (max-width: 768px) {
          .sh-sections-grid { grid-template-columns: 1fr; }
          .sh-cards-grid { grid-template-columns: repeat(2, 1fr); }
          .sh-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
