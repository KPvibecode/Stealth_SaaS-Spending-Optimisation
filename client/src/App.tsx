import { useState, useEffect } from 'react';

interface Subscription {
  id: number;
  name: string;
  vendor: string;
  cost_monthly: number;
  renewal_date: string;
  status: string;
  risk_level: string;
}

function App() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(res => res.json())
      .then(data => {
        setSubscriptions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <header>
        <h1>SaaS Spend Manager</h1>
        <p>Monitor subscriptions, detect risk, and enforce renewal decisions</p>
      </header>
      
      <main>
        <section className="dashboard">
          <div className="stat-card">
            <h3>Total Subscriptions</h3>
            <span className="stat-value">{subscriptions.length}</span>
          </div>
          <div className="stat-card">
            <h3>At Risk</h3>
            <span className="stat-value warning">
              {subscriptions.filter(s => s.risk_level === 'high').length}
            </span>
          </div>
          <div className="stat-card">
            <h3>Monthly Spend</h3>
            <span className="stat-value">
              ${subscriptions.reduce((sum, s) => sum + Number(s.cost_monthly || 0), 0).toFixed(2)}
            </span>
          </div>
        </section>

        <section className="subscriptions">
          <h2>Subscriptions</h2>
          {loading ? (
            <p>Loading...</p>
          ) : subscriptions.length === 0 ? (
            <p className="empty-state">No subscriptions yet. Add your first SaaS subscription to get started.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Vendor</th>
                  <th>Monthly Cost</th>
                  <th>Renewal Date</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td>{sub.name}</td>
                    <td>{sub.vendor}</td>
                    <td>${sub.cost_monthly}</td>
                    <td>{sub.renewal_date}</td>
                    <td className={`risk-${sub.risk_level}`}>{sub.risk_level}</td>
                    <td>{sub.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
