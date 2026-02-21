import { Router } from 'express';
import { db } from '../db/index.js';
import crypto from 'crypto';

const router = Router();

const mockDepartments = [
  { name: 'Engineering', team_lead_email: 'alex.chen@company.com', team_lead_name: 'Alex Chen' },
  { name: 'Marketing', team_lead_email: 'sarah.johnson@company.com', team_lead_name: 'Sarah Johnson' },
  { name: 'Sales', team_lead_email: 'mike.rodriguez@company.com', team_lead_name: 'Mike Rodriguez' },
  { name: 'Finance', team_lead_email: 'lisa.wong@company.com', team_lead_name: 'Lisa Wong' },
  { name: 'HR', team_lead_email: 'james.taylor@company.com', team_lead_name: 'James Taylor' }
];

const mockTools = [
  { name: 'Slack', vendor: 'Salesforce', category: 'Collaboration', cost_monthly: 850, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Notion', vendor: 'Notion Labs', category: 'Productivity', cost_monthly: 480, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Figma', vendor: 'Figma Inc', category: 'Design', cost_monthly: 720, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'GitHub', vendor: 'Microsoft', category: 'Development', cost_monthly: 1200, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Jira', vendor: 'Atlassian', category: 'Project Management', cost_monthly: 650, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Zoom', vendor: 'Zoom Video', category: 'Collaboration', cost_monthly: 400, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'HubSpot', vendor: 'HubSpot Inc', category: 'Sales', cost_monthly: 1800, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Salesforce', vendor: 'Salesforce', category: 'Sales', cost_monthly: 3200, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Adobe Creative Cloud', vendor: 'Adobe', category: 'Design', cost_monthly: 1100, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'AWS', vendor: 'Amazon', category: 'Infrastructure', cost_monthly: 4500, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Datadog', vendor: 'Datadog Inc', category: 'Development', cost_monthly: 890, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Intercom', vendor: 'Intercom Inc', category: 'Customer Support', cost_monthly: 520, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Asana', vendor: 'Asana Inc', category: 'Project Management', cost_monthly: 380, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'DocuSign', vendor: 'DocuSign Inc', category: 'Legal', cost_monthly: 250, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Dropbox Business', vendor: 'Dropbox', category: 'Storage', cost_monthly: 300, billing_cadence: 'monthly', source_type: 'amex_csv' },
  { name: 'Monday.com', vendor: 'Monday.com', category: 'Project Management', cost_monthly: 420, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Miro', vendor: 'Miro Inc', category: 'Collaboration', cost_monthly: 280, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Linear', vendor: 'Linear Inc', category: 'Development', cost_monthly: 160, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Loom', vendor: 'Loom Inc', category: 'Collaboration', cost_monthly: 150, billing_cadence: 'monthly', source_type: 'microsoft_entra' },
  { name: 'Amplitude', vendor: 'Amplitude Inc', category: 'Analytics', cost_monthly: 950, billing_cadence: 'monthly', source_type: 'amex_csv' }
];

const categoryToDepartment: Record<string, string> = {
  'Development': 'Engineering',
  'Infrastructure': 'Engineering',
  'Design': 'Engineering',
  'Sales': 'Sales',
  'Marketing': 'Marketing',
  'Analytics': 'Marketing',
  'Finance': 'Finance',
  'Legal': 'Finance',
  'HR': 'HR',
  'Customer Support': 'Sales',
  'Collaboration': 'Engineering',
  'Productivity': 'Engineering',
  'Project Management': 'Engineering',
  'Storage': 'Engineering'
};

router.post('/seed', async (req, res) => {
  try {
    const existingTools = await db.query('SELECT COUNT(*) FROM detected_tools');
    if (parseInt(existingTools.rows[0].count) > 0) {
      return res.json({ success: true, message: 'Demo data already exists' });
    }

    await db.query(
      `INSERT INTO data_sources (type, name, status, tenant_id)
       VALUES ('microsoft_entra', 'Acme Corp (demo@acmecorp.com)', 'connected', 'demo-tenant-id')`
    );

    for (const dept of mockDepartments) {
      await db.query(
        'INSERT INTO departments (name, team_lead_email, team_lead_name) VALUES ($1, $2, $3)',
        [dept.name, dept.team_lead_email, dept.team_lead_name]
      );
    }

    const deptResult = await db.query('SELECT id, name FROM departments');
    const deptMap = new Map(deptResult.rows.map((d: any) => [d.name, d.id]));

    for (const tool of mockTools) {
      const deptName = categoryToDepartment[tool.category] || 'Engineering';
      const deptId = deptMap.get(deptName);
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + Math.floor(Math.random() * 90) + 10);

      await db.query(
        `INSERT INTO detected_tools 
         (name, vendor, normalized_name, category, source_type, cost_monthly, billing_cadence, department_id, renewal_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`,
        [tool.name, tool.vendor, tool.name.toLowerCase().replace(/\s+/g, '_'), tool.category, 
         tool.source_type, tool.cost_monthly, tool.billing_cadence, deptId, renewalDate]
      );
    }

    res.json({ success: true, message: `Seeded ${mockDepartments.length} departments and ${mockTools.length} SaaS tools` });
  } catch (error) {
    console.error('Error seeding demo data:', error);
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

router.post('/login', async (req, res) => {
  try {
    let user = await db.query('SELECT * FROM users WHERE email = $1', ['demo@company.com']);
    
    if (user.rows.length === 0) {
      const result = await db.query(
        `INSERT INTO users (microsoft_id, email, name, tenant_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        ['demo-user-' + Date.now(), 'demo@company.com', 'Demo User', 'demo-tenant']
      );
      user = { rows: [result.rows[0]] };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.rows[0].id, token, expiresAt]
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user: { email: user.rows[0].email, name: user.rows[0].name } });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

export default router;
