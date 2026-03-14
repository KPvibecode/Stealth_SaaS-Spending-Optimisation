import { useState, useEffect } from 'react';
import './index.css';

function formatSpend(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(amount)}`;
}

interface DetectedTool {
  id: number;
  name: string;
  vendor: string;
  category: string;
  source_type: string;
  cost_monthly: number;
  billing_cadence: string;
  department_name: string | null;
  assigned_team_lead: string | null;
  team_lead_name: string | null;
  status: string;
  renewal_date: string | null;
}

interface DecisionTool {
  id: number;
  name: string;
  vendor: string;
  category: string;
  cost_monthly: number;
  renewal_date: string | null;
  department_name: string | null;
  team_lead_name: string | null;
  team_lead_email: string | null;
  risk_score: number;
  risk_level: string;
  decision_id: number | null;
  decision_type: string | null;
  decision_status: string | null;
  decided_by_name: string | null;
  decision_date: string | null;
  decision_notes: string | null;
  last_notified_at: string | null;
  last_notif_tier: number | null;
  notif_recipient: string | null;
  email_action: string | null;
  email_action_at: string | null;
}

interface DecisionStats {
  total: number;
  pending: number;
  approved: number;
  cancelled: number;
  under_review: number;
  high_risk: number;
  overdue: number;
  completion_rate: number;
}

interface Department {
  id: number;
  name: string;
  team_lead_email: string;
  team_lead_name: string;
  tool_count: number;
  total_spend: number;
}

interface Stats {
  total_tools: number;
  categories: number;
  total_monthly_spend: number;
  unassigned: number;
  duplicates: number;
  byCategory: { category: string; count: number; spend: number }[];
  bySource: { source_type: string; count: number }[];
}

interface User {
  id: number;
  email: string;
  name: string;
}

type TabType = 'dashboard' | 'tools' | 'decisions' | 'departments' | 'connect';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [tools, setTools] = useState<DetectedTool[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftAccount, setMicrosoftAccount] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [decisionTools, setDecisionTools] = useState<DecisionTool[]>([]);
  const [decisionStats, setDecisionStats] = useState<DecisionStats | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [toolSearch, setToolSearch] = useState('');

  const [newDept, setNewDept] = useState({ name: '', team_lead_email: '', team_lead_name: '' });
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function getSortedTools() {
    if (!Array.isArray(tools)) return [];
    let filtered = [...tools];
    if (toolSearch.trim()) {
      const q = toolSearch.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.vendor.toLowerCase().includes(q) ||
        (t.department_name || '').toLowerCase().includes(q)
      );
    }
    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'category': aVal = a.category.toLowerCase(); bVal = b.category.toLowerCase(); break;
        case 'cost': aVal = Number(a.cost_monthly) || 0; bVal = Number(b.cost_monthly) || 0; break;
        case 'source': aVal = a.source_type; bVal = b.source_type; break;
        case 'department': aVal = (a.department_name || '').toLowerCase(); bVal = (b.department_name || '').toLowerCase(); break;
        case 'teamLead': aVal = (a.team_lead_name || '').toLowerCase(); bVal = (b.team_lead_name || '').toLowerCase(); break;
        default: aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    if (user) { loadData(); loadDecisions(); checkMicrosoftStatus(); }
  }, [user]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) setUser(data.user);
    } catch (error) { console.error('Auth check failed:', error); }
    setAuthChecked(true);
  }

  async function handleLogout() {
    try {
      await fetch('/api/user/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (error) { console.error('Logout failed:', error); }
  }

  async function enterDemoMode() {
    try {
      await fetch('/api/demo/seed', { method: 'POST', credentials: 'include' });
      const res = await fetch('/api/demo/login', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) setUser({ id: 0, email: data.user.email, name: data.user.name });
    } catch (error) {
      console.error('Demo mode failed:', error);
      setMessage({ type: 'error', text: 'Failed to enter demo mode' });
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [toolsRes, statsRes, deptsRes] = await Promise.all([
        fetch('/api/tools', { credentials: 'include' }),
        fetch('/api/tools/stats', { credentials: 'include' }),
        fetch('/api/departments', { credentials: 'include' })
      ]);
      if (toolsRes.ok) { const d = await toolsRes.json(); setTools(Array.isArray(d) ? d : []); }
      if (statsRes.ok) setStats(await statsRes.json());
      if (deptsRes.ok) { const d = await deptsRes.json(); setDepartments(Array.isArray(d) ? d : []); }
    } catch (error) { console.error('Failed to load data:', error); }
    setLoading(false);
  }

  async function checkMicrosoftStatus() {
    try {
      const res = await fetch('/api/auth/microsoft/status', { credentials: 'include' });
      const data = await res.json();
      setMicrosoftConnected(data.connected);
      if (data.accountName) setMicrosoftAccount(data.accountName);
    } catch (error) { console.error('Failed to check Microsoft status:', error); }
  }

  async function loadDecisions() {
    try {
      const [toolsRes, statsRes] = await Promise.all([
        fetch('/api/decisions', { credentials: 'include' }),
        fetch('/api/decisions/stats', { credentials: 'include' })
      ]);
      if (toolsRes.ok) { const d = await toolsRes.json(); setDecisionTools(Array.isArray(d) ? d : []); }
      if (statsRes.ok) setDecisionStats(await statsRes.json());
    } catch (error) { console.error('Failed to load decisions:', error); }
  }

  async function makeDecision(toolId: number, decisionType: string, notes?: string) {
    try {
      const res = await fetch(`/api/decisions/${toolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_type: decisionType, notes }),
        credentials: 'include'
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Decision recorded: ${decisionType}` });
        loadDecisions();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to record decision' });
      }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to record decision' }); }
  }

  function getDaysUntilRenewal(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function formatDate(date: string | null): string {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getNotificationStatus(tool: DecisionTool): { status: 'none' | 'sent' | 'action_taken' | 'expired'; label: string; detail: string; action?: string } {
    if (!tool.last_notified_at) return { status: 'none', label: 'No notification sent', detail: '' };
    if (tool.email_action && tool.email_action_at) {
      const actionLabels: Record<string, string> = { approved: 'Approved', cancelled: 'Cancelled', under_review: 'Under Review' };
      return {
        status: 'action_taken', label: 'Action Taken via Email',
        detail: `${actionLabels[tool.email_action] || tool.email_action} by ${tool.notif_recipient} on ${formatDate(tool.email_action_at)}`,
        action: tool.email_action
      };
    }
    const daysLeft = getDaysUntilRenewal(tool.renewal_date);
    if (daysLeft !== null && daysLeft <= 0) {
      return { status: 'expired', label: 'Action Missed', detail: `Notified ${tool.notif_recipient} (${tool.last_notif_tier}-day reminder) — renewal date passed` };
    }
    return { status: 'sent', label: 'Notification Sent', detail: `${tool.last_notif_tier}-day reminder sent to ${tool.notif_recipient} on ${formatDate(tool.last_notified_at)}` };
  }

  function getFilteredDecisions(): DecisionTool[] {
    if (!Array.isArray(decisionTools)) return [];
    if (decisionFilter === 'all') return decisionTools;
    if (decisionFilter === 'pending') return decisionTools.filter(t => !t.decision_status || t.decision_status === 'pending');
    if (decisionFilter === 'high_risk') return decisionTools.filter(t => t.risk_score >= 50);
    return decisionTools.filter(t => t.decision_status === decisionFilter);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload/csv', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Imported ${data.saasDetected} SaaS tools from ${data.transactionsStored} transactions` });
        loadData();
      } else { setMessage({ type: 'error', text: data.error || 'Upload failed' }); }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to upload file' }); }
    setUploading(false);
    e.target.value = '';
  }

  async function runDeduplication() {
    try {
      const res = await fetch('/api/tools/deduplicate', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setMessage({ type: 'success', text: `Found and merged ${data.duplicatesFound} duplicate tools` });
      loadData();
    } catch (error) { setMessage({ type: 'error', text: 'Deduplication failed' }); }
  }

  async function autoAssignTools() {
    try {
      const res = await fetch('/api/departments/auto-assign', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) { setMessage({ type: 'success', text: data.message }); loadData(); }
      else { setMessage({ type: 'error', text: data.error }); }
    } catch (error) { setMessage({ type: 'error', text: 'Auto-assign failed' }); }
  }

  async function syncMicrosoftApps() {
    try {
      const res = await fetch('/api/graph/sync-enterprise-apps', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) { setMessage({ type: 'success', text: data.message }); loadData(); }
      else { setMessage({ type: 'error', text: data.error }); }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to sync Microsoft apps' }); }
  }

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDept.name) return;
    try {
      const res = await fetch('/api/departments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDept), credentials: 'include'
      });
      const data = await res.json();
      if (data.id) {
        setMessage({ type: 'success', text: `Department "${data.name}" created` });
        setNewDept({ name: '', team_lead_email: '', team_lead_name: '' });
        loadData();
      }
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create department' }); }
  }

  async function assignToolToDepartment(toolId: number, departmentId: number | null) {
    try {
      await fetch(`/api/tools/${toolId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: departmentId }), credentials: 'include'
      });
      loadData();
    } catch (error) { setMessage({ type: 'error', text: 'Failed to assign tool' }); }
  }

  if (!authChecked) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SaaS Manager</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SaaS Manager</h1>
          <p>Manage your SaaS subscriptions, detect spend risks, and make renewal decisions before billing.</p>
          <a href="/api/user/login" className="btn primary login-btn">Sign in with Microsoft</a>
          <div className="divider"><span>or</span></div>
          <button onClick={enterDemoMode} className="btn secondary demo-btn">Try Demo Mode</button>
          <p className="demo-note">No login required. Explore with sample data.</p>
        </div>
      </div>
    );
  }

  const urgentDecisions = (decisionTools || [])
    .filter(t => !t.decision_status || t.decision_status === 'pending' || t.decision_status === 'under_review')
    .sort((a, b) => b.risk_score - a.risk_score);

  const overdueCount = urgentDecisions.filter(t => {
    const d = getDaysUntilRenewal(t.renewal_date);
    return d !== null && d <= 0;
  }).length;

  const maxCatSpend = Math.max(...(stats?.byCategory || []).map(c => Number(c.spend)), 1);

  const completionRate = decisionStats?.completion_rate || 0;

  const donutSegments = (() => {
    if (!decisionStats || decisionStats.total === 0) return '';
    const total = decisionStats.total;
    const approved = (decisionStats.approved / total) * 100;
    const cancelled = (decisionStats.cancelled / total) * 100;
    const review = (decisionStats.under_review / total) * 100;
    const pending = 100 - approved - cancelled - review;
    let pos = 0;
    const segments = [];
    if (approved > 0) { segments.push(`var(--color-success) ${pos}% ${pos + approved}%`); pos += approved; }
    if (cancelled > 0) { segments.push(`var(--color-danger) ${pos}% ${pos + cancelled}%`); pos += cancelled; }
    if (review > 0) { segments.push(`var(--color-info) ${pos}% ${pos + review}%`); pos += review; }
    if (pending > 0) { segments.push(`#e5e7eb ${pos}% ${pos + pending}%`); }
    return `conic-gradient(${segments.join(', ')})`;
  })();

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <h2>SaaS Manager</h2>
          <div className="logo-subtitle">Spend Management</div>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <span className="nav-icon">&#9632;</span> Dashboard
          </li>
          <li className={activeTab === 'decisions' ? 'active' : ''} onClick={() => setActiveTab('decisions')}>
            <span className="nav-icon">&#9998;</span> Decisions
            {decisionStats && decisionStats.pending > 0 && (
              <span className="nav-badge">{decisionStats.pending}</span>
            )}
          </li>
          <li className={activeTab === 'tools' ? 'active' : ''} onClick={() => setActiveTab('tools')}>
            <span className="nav-icon">&#8864;</span> Tools
          </li>
          <li className={activeTab === 'departments' ? 'active' : ''} onClick={() => setActiveTab('departments')}>
            <span className="nav-icon">&#9776;</span> Departments
          </li>
          <li className={activeTab === 'connect' ? 'active' : ''} onClick={() => setActiveTab('connect')}>
            <span className="nav-icon">&#8644;</span> Connect
          </li>
        </ul>
        <div className="user-menu">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">Sign out</button>
        </div>
      </nav>

      <main className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>&times;</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="page-header">
              <h1>Dashboard</h1>
              <p>SaaS spend overview and renewal decisions</p>
            </div>

            {loading && (
              <div className="stats-grid">
                <div className="skeleton skeleton-card" />
                <div className="skeleton skeleton-card" />
                <div className="skeleton skeleton-card" />
                <div className="skeleton skeleton-card" />
              </div>
            )}

            {!loading && overdueCount > 0 && (
              <div className="alert-banner">
                <span className="alert-icon">&#9888;</span>
                <span>{overdueCount} tool{overdueCount > 1 ? 's have' : ' has'} passed {overdueCount > 1 ? 'their' : 'its'} renewal date without a decision.</span>
                <span className="alert-action" onClick={() => { setDecisionFilter('pending'); setActiveTab('decisions'); }}>Review now</span>
              </div>
            )}

            {!loading && <><div className="stats-grid">
              <div className="stat-card">
                <h3>Monthly Spend</h3>
                <span className="stat-value">{formatSpend(Number(stats?.total_monthly_spend || 0))}</span>
                <div className="stat-trend neutral">{stats?.total_tools || 0} active tools</div>
              </div>
              <div className="stat-card clickable" onClick={() => setActiveTab('decisions')}>
                <h3>Pending Decisions</h3>
                <span className={`stat-value ${(decisionStats?.pending || 0) > 0 ? 'warning' : ''}`}>{decisionStats?.pending || 0}</span>
                <div className="stat-trend neutral">of {decisionStats?.total || 0} total</div>
              </div>
              <div className="stat-card clickable" onClick={() => { setDecisionFilter('high_risk'); setActiveTab('decisions'); }}>
                <h3>High Risk</h3>
                <span className={`stat-value ${(decisionStats?.high_risk || 0) > 0 ? 'danger' : ''}`}>{decisionStats?.high_risk || 0}</span>
                <div className="stat-trend neutral">score {'\u2265'} 50</div>
              </div>
              <div className="stat-card">
                <h3>Completion Rate</h3>
                <span className={`stat-value ${completionRate >= 80 ? 'success' : completionRate >= 50 ? 'warning' : 'danger'}`}>{completionRate}%</span>
                <div className="stat-trend neutral">decisions made</div>
              </div>
            </div>

            <div className="two-col">
              <div className="panel">
                <div className="panel-header">
                  <h2>Decision Status</h2>
                </div>
                <div className="decision-summary-grid">
                  <div className="summary-stat">
                    <span className="summary-stat-value success">{decisionStats?.approved || 0}</span>
                    <span className="summary-stat-label">Approved</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value danger">{decisionStats?.cancelled || 0}</span>
                    <span className="summary-stat-label">Cancelled</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value info">{decisionStats?.under_review || 0}</span>
                    <span className="summary-stat-label">In Review</span>
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-label">
                    <span>Completion</span>
                    <span>{completionRate}%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${completionRate >= 80 ? 'green' : completionRate >= 50 ? 'yellow' : 'red'}`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Decision Breakdown</h2>
                </div>
                <div className="panel-body">
                  {decisionStats && decisionStats.total > 0 ? (
                    <div className="donut-chart">
                      <div className="donut-ring" style={{ background: donutSegments }}>
                        <div className="donut-center">
                          <span className="donut-center-value">{decisionStats.total}</span>
                          <span className="donut-center-label">Tools</span>
                        </div>
                      </div>
                      <div className="donut-legend">
                        <div className="legend-item">
                          <span className="legend-dot" style={{ background: 'var(--color-success)' }} />
                          <span className="legend-label">Approved</span>
                          <span className="legend-value">{decisionStats.approved}</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot" style={{ background: 'var(--color-danger)' }} />
                          <span className="legend-label">Cancelled</span>
                          <span className="legend-value">{decisionStats.cancelled}</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot" style={{ background: 'var(--color-info)' }} />
                          <span className="legend-label">In Review</span>
                          <span className="legend-value">{decisionStats.under_review}</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot" style={{ background: '#e5e7eb' }} />
                          <span className="legend-label">Pending</span>
                          <span className="legend-value">{decisionStats.pending}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="empty-text">No tools discovered yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="two-col">
              <div className="panel">
                <div className="panel-header">
                  <h2>Urgent Decisions</h2>
                  {urgentDecisions.length > 5 && (
                    <span className="view-all" onClick={() => { setDecisionFilter('pending'); setActiveTab('decisions'); }}>View all &rarr;</span>
                  )}
                </div>
                <div className="panel-body">
                  {urgentDecisions.length > 0 ? (
                    <div className="urgent-list">
                      {urgentDecisions.slice(0, 5).map(tool => {
                        const days = getDaysUntilRenewal(tool.renewal_date);
                        return (
                          <div key={tool.id} className="urgent-item">
                            <span className={`urgent-risk-dot ${tool.risk_level}`} />
                            <div className="urgent-info">
                              <span className="urgent-name">{tool.name}</span>
                              <span className="urgent-vendor">{tool.vendor}</span>
                            </div>
                            <div className="urgent-meta">
                              <span className="urgent-cost">{formatSpend(Number(tool.cost_monthly))}/mo</span>
                              <span className={`urgent-days ${days !== null && days <= 7 ? 'danger' : ''}`}>
                                {days !== null ? (days <= 0 ? 'Overdue' : `${days}d`) : '—'}
                              </span>
                            </div>
                            <div className="urgent-actions">
                              <button className="btn small success" onClick={() => makeDecision(tool.id, 'approved')}>Renew</button>
                              <button className="btn small danger" onClick={() => makeDecision(tool.id, 'cancelled')}>Cancel</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-text">All decisions are up to date</p>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Spend by Category</h2>
                </div>
                <div className="panel-body">
                  {(stats?.byCategory || []).length > 0 ? (
                    <div className="bar-chart">
                      {(stats?.byCategory || []).slice(0, 6).map(cat => (
                        <div key={cat.category} className="bar-row">
                          <span className="bar-label">{cat.category}</span>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(Number(cat.spend) / maxCatSpend) * 100}%` }} />
                          </div>
                          <span className="bar-value">{formatSpend(Number(cat.spend))}/mo</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-text">No spend data yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="actions-bar">
              <button onClick={runDeduplication} className="btn secondary">Find Duplicates</button>
              <button onClick={autoAssignTools} className="btn secondary">Auto-Assign Departments</button>
            </div>
            </>}
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="decisions-page">
            <div className="page-header">
              <h1>Renewal Decisions</h1>
              <p>Review and decide on tool renewals before billing dates</p>
            </div>

            <div className="decision-filters">
              <button className={`filter-btn ${decisionFilter === 'all' ? 'active' : ''}`} onClick={() => setDecisionFilter('all')}>
                All ({decisionStats?.total || 0})
              </button>
              <button className={`filter-btn ${decisionFilter === 'pending' ? 'active' : ''}`} onClick={() => setDecisionFilter('pending')}>
                Pending ({decisionStats?.pending || 0})
              </button>
              <button className={`filter-btn ${decisionFilter === 'high_risk' ? 'active' : ''}`} onClick={() => setDecisionFilter('high_risk')}>
                High Risk ({decisionStats?.high_risk || 0})
              </button>
              <button className={`filter-btn ${decisionFilter === 'approved' ? 'active' : ''}`} onClick={() => setDecisionFilter('approved')}>
                Approved ({decisionStats?.approved || 0})
              </button>
              <button className={`filter-btn ${decisionFilter === 'cancelled' ? 'active' : ''}`} onClick={() => setDecisionFilter('cancelled')}>
                Cancelled ({decisionStats?.cancelled || 0})
              </button>
              <button className={`filter-btn ${decisionFilter === 'under_review' ? 'active' : ''}`} onClick={() => setDecisionFilter('under_review')}>
                In Review ({decisionStats?.under_review || 0})
              </button>
            </div>

            <div className="decisions-list">
              {getFilteredDecisions().map(tool => {
                const days = getDaysUntilRenewal(tool.renewal_date);
                const status = tool.decision_status || 'pending';
                return (
                  <div key={tool.id} className={`decision-card ${status}`}>
                    <div className="decision-header">
                      <div className="decision-tool-info">
                        <h3>{tool.name}</h3>
                        <span className="decision-vendor">{tool.vendor}</span>
                      </div>
                      <div className="risk-score-display">
                        <div className={`risk-score-circle ${tool.risk_level}`}>{tool.risk_score}</div>
                        <span className="risk-label">{tool.risk_level} risk</span>
                      </div>
                    </div>

                    <div className="decision-details">
                      <div className="detail-item">
                        <span className="detail-label">Cost</span>
                        <span className="detail-value">{formatSpend(Number(tool.cost_monthly))}/mo</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Renewal</span>
                        <span className={`detail-value ${days !== null && days <= 7 ? 'danger' : ''}`}>
                          {formatDate(tool.renewal_date)}
                          {days !== null && (
                            <span className="days-badge">{days <= 0 ? 'Overdue!' : `${days}d left`}</span>
                          )}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Department</span>
                        <span className="detail-value">{tool.department_name || 'Unassigned'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Team Lead</span>
                        <span className="detail-value">{tool.team_lead_name || 'None'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Category</span>
                        <span className="detail-value">{tool.category}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status</span>
                        <span className={`status-badge ${status}`}>{status.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {(() => {
                      const notif = getNotificationStatus(tool);
                      return (
                        <div className={`notification-status ${notif.status}`}>
                          <div className="notif-indicator">
                            <span className={`notif-icon ${notif.status}`}>
                              {notif.status === 'sent' && '\u2709'}
                              {notif.status === 'action_taken' && '\u2713'}
                              {notif.status === 'expired' && '\u26A0'}
                              {notif.status === 'none' && '\u2014'}
                            </span>
                            <div className="notif-text">
                              <span className="notif-label">{notif.label}</span>
                              {notif.detail && <span className="notif-detail">{notif.detail}</span>}
                            </div>
                          </div>
                          {notif.action && (
                            <span className={`notif-action-badge ${notif.action}`}>
                              {notif.action === 'approved' ? 'Renewed' : notif.action === 'cancelled' ? 'Cancelled' : 'Under Review'}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {tool.decision_notes && (
                      <div className="decision-notes">
                        <span className="notes-label">Notes:</span> {tool.decision_notes}
                        {tool.decided_by_name && <span className="decided-by"> — {tool.decided_by_name}</span>}
                      </div>
                    )}

                    <div className="decision-actions">
                      {status === 'pending' || status === 'under_review' ? (
                        <>
                          <button className="btn success" onClick={() => makeDecision(tool.id, 'approved', 'Renewed')}>Renew</button>
                          <button className="btn warning" onClick={() => makeDecision(tool.id, 'under_review', 'Needs further evaluation')}>Review</button>
                          <button className="btn danger" onClick={() => makeDecision(tool.id, 'cancelled', 'Not needed')}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn secondary" onClick={() => makeDecision(tool.id, 'pending')}>Reopen</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {getFilteredDecisions().length === 0 && (
                <div className="empty-state">
                  <p>No tools match this filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="tools-page">
            <div className="page-header">
              <h1>Discovered Tools</h1>
              <p>{tools.length} SaaS tools detected across all sources</p>
            </div>

            {loading ? (
              <div>
                <div className="skeleton skeleton-row" />
                <div className="skeleton skeleton-row" />
                <div className="skeleton skeleton-row" />
              </div>
            ) : tools.length === 0 ? (
              <div className="empty-state">
                <p>No SaaS tools discovered yet.</p>
                <p>Connect Microsoft Entra or upload an Amex CSV to get started.</p>
                <button className="btn primary" onClick={() => setActiveTab('connect')}>Connect Data Source</button>
              </div>
            ) : (
              <>
                <div className="search-bar">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search tools by name, vendor, or department..."
                    value={toolSearch}
                    onChange={e => setToolSearch(e.target.value)}
                  />
                </div>
                <table className="tools-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleSort('name')}>
                        Name {sortColumn === 'name' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('cost')}>
                        Monthly Cost {sortColumn === 'cost' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('source')}>
                        Source {sortColumn === 'source' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('department')}>
                        Department {sortColumn === 'department' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('teamLead')}>
                        Team Lead {sortColumn === 'teamLead' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedTools().map(tool => (
                      <tr key={tool.id}>
                        <td>
                          <strong>{tool.name}</strong>
                          <span className="vendor-text"> — {tool.vendor}</span>
                        </td>
                        <td>${Number(tool.cost_monthly || 0).toFixed(2)}</td>
                        <td>{tool.source_type === 'microsoft_entra' ? 'Microsoft Entra' : 'Amex CSV'}</td>
                        <td>
                          <select
                            value={tool.department_name || ''}
                            onChange={(e) => {
                              const dept = (departments || []).find(d => d.name === e.target.value);
                              assignToolToDepartment(tool.id, dept?.id || null);
                            }}
                          >
                            <option value="">Unassigned</option>
                            {(departments || []).map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {tool.team_lead_name ? (
                            <span className="team-lead-name" title={tool.assigned_team_lead || ''}>
                              {tool.team_lead_name}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="departments-page">
            <div className="page-header">
              <h1>Departments</h1>
              <p>Manage teams and assign tool ownership</p>
            </div>

            <form className="add-dept-form" onSubmit={createDepartment}>
              <input type="text" placeholder="Department name" value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} required />
              <input type="text" placeholder="Team lead name" value={newDept.team_lead_name} onChange={e => setNewDept({ ...newDept, team_lead_name: e.target.value })} />
              <input type="email" placeholder="Team lead email" value={newDept.team_lead_email} onChange={e => setNewDept({ ...newDept, team_lead_email: e.target.value })} />
              <button type="submit" className="btn primary">Add Department</button>
            </form>

            <div className="departments-list">
              {(departments || []).map(dept => (
                <div key={dept.id} className="department-card">
                  <h3>{dept.name}</h3>
                  <p className="lead">Team Lead: {dept.team_lead_name || 'Not assigned'}</p>
                  <p className="email">{dept.team_lead_email}</p>
                  <div className="dept-stats">
                    <span>{dept.tool_count} tools</span>
                    <span>{formatSpend(Number(dept.total_spend || 0))}/mo</span>
                  </div>
                </div>
              ))}
              {(departments || []).length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <p>No departments created yet.</p>
                  <p>Add a department above to start organizing tool ownership.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'connect' && (
          <div className="connect-page">
            <div className="page-header">
              <h1>Connect Data Sources</h1>
              <p>Import SaaS tools from your organization's systems</p>
            </div>

            <div className="data-source-cards">
              <div className="source-card">
                <h3>Microsoft Entra</h3>
                <p>Sync enterprise applications from your Microsoft 365 tenant.</p>
                {microsoftConnected ? (
                  <div className="connected-status">
                    <div className="connected-info">
                      <span className="status-badge connected">Connected</span>
                      {microsoftAccount && <span className="connected-account">{microsoftAccount}</span>}
                    </div>
                    <button onClick={syncMicrosoftApps} className="btn primary">Sync Now</button>
                  </div>
                ) : (
                  <a href="/api/auth/microsoft/login" className="btn primary">Connect Microsoft</a>
                )}
              </div>

              <div className="source-card">
                <h3>American Express CSV</h3>
                <p>Upload your Amex statement to detect SaaS subscriptions from transactions.</p>
                <label className={`btn primary upload-btn ${uploading ? 'disabled' : ''}`}>
                  {uploading ? 'Processing...' : 'Upload CSV'}
                  <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} hidden />
                </label>
                <p className="hint">Export your Amex transactions as CSV and upload here.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
