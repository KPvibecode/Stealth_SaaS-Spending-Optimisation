import { useState, useEffect } from 'react';
import './index.css';

function formatSpend(amount: number): string {
  if (amount >= 1000000) {
    return `$${Math.round(amount / 1000) / 1000}M`;
  } else if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
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

type TabType = 'dashboard' | 'tools' | 'departments' | 'connect';

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
    return [...tools].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = a.category.toLowerCase();
          bVal = b.category.toLowerCase();
          break;
        case 'cost':
          aVal = Number(a.cost_monthly) || 0;
          bVal = Number(b.cost_monthly) || 0;
          break;
        case 'source':
          aVal = a.source_type;
          bVal = b.source_type;
          break;
        case 'department':
          aVal = (a.department_name || '').toLowerCase();
          bVal = (b.department_name || '').toLowerCase();
          break;
        case 'teamLead':
          aVal = (a.team_lead_name || '').toLowerCase();
          bVal = (b.team_lead_name || '').toLowerCase();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      checkMicrosoftStatus();
    }
  }, [user]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    setAuthChecked(true);
  }

  async function handleLogout() {
    try {
      await fetch('/api/user/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  async function enterDemoMode() {
    try {
      await fetch('/api/demo/seed', { method: 'POST', credentials: 'include' });
      const res = await fetch('/api/demo/login', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setUser({ id: 0, email: data.user.email, name: data.user.name });
      }
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
      
      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setTools(Array.isArray(toolsData) ? toolsData : []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(Array.isArray(deptsData) ? deptsData : []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  }

  async function checkMicrosoftStatus() {
    try {
      const res = await fetch('/api/auth/microsoft/status', { credentials: 'include' });
      const data = await res.json();
      setMicrosoftConnected(data.connected);
      if (data.accountName) {
        setMicrosoftAccount(data.accountName);
      }
    } catch (error) {
      console.error('Failed to check Microsoft status:', error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/csv', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Imported ${data.saasDetected} SaaS tools from ${data.transactionsStored} transactions` });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload file' });
    }
    setUploading(false);
    e.target.value = '';
  }

  async function runDeduplication() {
    try {
      const res = await fetch('/api/tools/deduplicate', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setMessage({ type: 'success', text: `Found and merged ${data.duplicatesFound} duplicate tools` });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Deduplication failed' });
    }
  }

  async function autoAssignTools() {
    try {
      const res = await fetch('/api/departments/auto-assign', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Auto-assign failed' });
    }
  }

  async function syncMicrosoftApps() {
    try {
      const res = await fetch('/api/graph/sync-enterprise-apps', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to sync Microsoft apps' });
    }
  }

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDept.name) return;

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDept),
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.id) {
        setMessage({ type: 'success', text: `Department "${data.name}" created` });
        setNewDept({ name: '', team_lead_email: '', team_lead_name: '' });
        loadData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create department' });
    }
  }

  async function assignToolToDepartment(toolId: number, departmentId: number | null) {
    try {
      await fetch(`/api/tools/${toolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: departmentId }),
        credentials: 'include'
      });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign tool' });
    }
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
          <a href="/api/user/login" className="btn primary login-btn">
            Sign in with Microsoft
          </a>
          <div className="divider">
            <span>or</span>
          </div>
          <button onClick={enterDemoMode} className="btn secondary demo-btn">
            Try Demo Mode
          </button>
          <p className="demo-note">No login required. Explore with sample data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <h2>SaaS Manager</h2>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </li>
          <li className={activeTab === 'tools' ? 'active' : ''} onClick={() => setActiveTab('tools')}>
            Discovered Tools
          </li>
          <li className={activeTab === 'departments' ? 'active' : ''} onClick={() => setActiveTab('departments')}>
            Departments
          </li>
          <li className={activeTab === 'connect' ? 'active' : ''} onClick={() => setActiveTab('connect')}>
            Connect Data
          </li>
        </ul>
        <div className="user-menu">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button onClick={handleLogout} className="btn logout-btn">Logout</button>
        </div>
      </nav>

      <main className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h1>SaaS Inventory Dashboard</h1>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Tools</h3>
                <span className="stat-value">{stats?.total_tools || 0}</span>
              </div>
              <div className="stat-card">
                <h3>Monthly Spend</h3>
                <span className="stat-value">{formatSpend(Number(stats?.total_monthly_spend || 0))}</span>
              </div>
              <div className="stat-card">
                <h3>Unassigned</h3>
                <span className="stat-value warning">{stats?.unassigned || 0}</span>
              </div>
              <div className="stat-card">
                <h3>Categories</h3>
                <span className="stat-value">{stats?.categories || 0}</span>
              </div>
            </div>

            <div className="actions-bar">
              <button onClick={runDeduplication} className="btn secondary">
                Find Duplicates
              </button>
              <button onClick={autoAssignTools} className="btn secondary">
                Auto-Assign to Departments
              </button>
            </div>

            <div className="category-breakdown">
              <h2>Spend by Category</h2>
              <div className="category-list">
                {(stats?.byCategory || []).map(cat => (
                  <div key={cat.category} className="category-item">
                    <span className="category-name">{cat.category}</span>
                    <span className="category-count">{cat.count} tools</span>
                    <span className="category-spend">${Number(cat.spend).toFixed(2)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="tools-page">
            <h1>Discovered SaaS Tools</h1>
            
            {loading ? (
              <p>Loading...</p>
            ) : tools.length === 0 ? (
              <div className="empty-state">
                <p>No SaaS tools discovered yet.</p>
                <p>Connect Microsoft Entra or upload an Amex CSV to get started.</p>
              </div>
            ) : (
              <table className="tools-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('name')}>
                      Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('cost')}>
                      Monthly Cost {sortColumn === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('source')}>
                      Source {sortColumn === 'source' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('department')}>
                      Department {sortColumn === 'department' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('teamLead')}>
                      Team Lead {sortColumn === 'teamLead' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedTools().map(tool => (
                    <tr key={tool.id}>
                      <td>
                        <strong>{tool.name}</strong>
                        <span className="vendor-text"> - {tool.vendor}</span>
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
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="departments-page">
            <h1>Departments & Team Leads</h1>

            <form className="add-dept-form" onSubmit={createDepartment}>
              <input
                type="text"
                placeholder="Department name"
                value={newDept.name}
                onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Team lead name"
                value={newDept.team_lead_name}
                onChange={e => setNewDept({ ...newDept, team_lead_name: e.target.value })}
              />
              <input
                type="email"
                placeholder="Team lead email"
                value={newDept.team_lead_email}
                onChange={e => setNewDept({ ...newDept, team_lead_email: e.target.value })}
              />
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
                    <span>${Number(dept.total_spend || 0).toFixed(2)}/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'connect' && (
          <div className="connect-page">
            <h1>Connect Data Sources</h1>

            <div className="data-source-cards">
              <div className="source-card">
                <h3>Microsoft Entra</h3>
                <p>Sync enterprise applications from your Microsoft 365 tenant.</p>
                {microsoftConnected ? (
                  <div className="connected-status">
                    <div className="connected-info">
                      <span className="status-badge connected">Connected</span>
                      {microsoftAccount && (
                        <span className="connected-account">{microsoftAccount}</span>
                      )}
                    </div>
                    <button onClick={syncMicrosoftApps} className="btn primary">
                      Sync Apps Now
                    </button>
                  </div>
                ) : (
                  <a href="/api/auth/microsoft/login" className="btn primary">
                    Connect Microsoft
                  </a>
                )}
              </div>

              <div className="source-card">
                <h3>American Express CSV</h3>
                <p>Upload your Amex statement to detect SaaS subscriptions from transactions.</p>
                <label className={`btn primary upload-btn ${uploading ? 'disabled' : ''}`}>
                  {uploading ? 'Processing...' : 'Upload CSV'}
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                    hidden 
                  />
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
