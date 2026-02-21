import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from './userAuth.js';

const router = Router();

router.use(requireAuth as any);

function calculateRiskScore(tool: any): number {
  let score = 0;

  if (tool.renewal_date) {
    const daysUntilRenewal = Math.ceil(
      (new Date(tool.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilRenewal <= 0) {
      score += 40;
    } else if (daysUntilRenewal <= 7) {
      score += 35;
    } else if (daysUntilRenewal <= 14) {
      score += 30;
    } else if (daysUntilRenewal <= 30) {
      score += 20;
    } else if (daysUntilRenewal <= 60) {
      score += 10;
    }
  } else {
    score += 15;
  }

  const cost = Number(tool.cost_monthly) || 0;
  if (cost >= 3000) {
    score += 30;
  } else if (cost >= 1000) {
    score += 20;
  } else if (cost >= 500) {
    score += 15;
  } else if (cost >= 100) {
    score += 10;
  }

  if (!tool.department_id) {
    score += 10;
  }
  if (!tool.owner_email) {
    score += 10;
  }

  if (!tool.decision_status || tool.decision_status === 'pending') {
    score += 10;
  }

  return Math.min(score, 100);
}

function getRiskLevel(score: number): string {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        dt.*,
        d.name as department_name,
        d.team_lead_email,
        d.team_lead_name,
        dec.id as decision_id,
        dec.decision_type,
        dec.status as decision_status,
        dec.decided_by_email,
        dec.decided_by_name,
        dec.due_date,
        dec.decision_date,
        dec.notes as decision_notes,
        notif.last_notified_at,
        notif.last_notif_tier,
        notif.notif_recipient,
        email_act.email_action,
        email_act.email_action_at
      FROM detected_tools dt
      LEFT JOIN departments d ON dt.department_id = d.id
      LEFT JOIN LATERAL (
        SELECT * FROM decisions 
        WHERE decisions.tool_id = dt.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dec ON true
      LEFT JOIN LATERAL (
        SELECT sent_at as last_notified_at, days_before_renewal as last_notif_tier, recipient_email as notif_recipient
        FROM notification_logs
        WHERE notification_logs.tool_id = dt.id
        ORDER BY sent_at DESC
        LIMIT 1
      ) notif ON true
      LEFT JOIN LATERAL (
        SELECT action as email_action, used_at as email_action_at
        FROM email_action_tokens
        WHERE email_action_tokens.tool_id = dt.id AND email_action_tokens.used_at IS NOT NULL
        ORDER BY used_at DESC
        LIMIT 1
      ) email_act ON true
      WHERE dt.is_duplicate = FALSE OR dt.is_duplicate IS NULL
      ORDER BY dt.renewal_date ASC NULLS LAST
    `);

    const toolsWithRisk = result.rows.map(tool => {
      const risk_score = calculateRiskScore(tool);
      return {
        ...tool,
        risk_score,
        risk_level: getRiskLevel(risk_score)
      };
    });

    toolsWithRisk.sort((a, b) => b.risk_score - a.risk_score);

    res.json(toolsWithRisk);
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const tools = await db.query(`
      SELECT 
        dt.*,
        dec.status as decision_status
      FROM detected_tools dt
      LEFT JOIN LATERAL (
        SELECT status FROM decisions 
        WHERE decisions.tool_id = dt.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dec ON true
      WHERE dt.is_duplicate = FALSE OR dt.is_duplicate IS NULL
    `);

    let pending = 0;
    let approved = 0;
    let cancelled = 0;
    let underReview = 0;
    let highRisk = 0;
    let overdue = 0;

    for (const tool of tools.rows) {
      const score = calculateRiskScore(tool);
      const status = tool.decision_status || 'pending';

      if (status === 'pending') pending++;
      if (status === 'approved') approved++;
      if (status === 'cancelled') cancelled++;
      if (status === 'under_review') underReview++;
      if (score >= 50) highRisk++;

      if (tool.renewal_date) {
        const daysLeft = Math.ceil(
          (new Date(tool.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 0 && status === 'pending') overdue++;
      }
    }

    const total = tools.rows.length;
    const decided = approved + cancelled;
    const completionRate = total > 0 ? Math.round((decided / total) * 100) : 0;

    res.json({
      total,
      pending,
      approved,
      cancelled,
      under_review: underReview,
      high_risk: highRisk,
      overdue,
      completion_rate: completionRate
    });
  } catch (error) {
    console.error('Error fetching decision stats:', error);
    res.status(500).json({ error: 'Failed to fetch decision stats' });
  }
});

router.post('/:toolId', async (req, res) => {
  const { toolId } = req.params;
  const { decision_type, notes } = req.body;
  const user = (req as any).user;

  if (!decision_type || !['approved', 'cancelled', 'under_review', 'pending'].includes(decision_type)) {
    return res.status(400).json({ error: 'Invalid decision_type. Must be: approved, cancelled, under_review, or pending' });
  }

  try {
    const tool = await db.query('SELECT * FROM detected_tools WHERE id = $1', [toolId]);
    if (tool.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const existing = await db.query(
      'SELECT id FROM decisions WHERE tool_id = $1 AND status = $2',
      [toolId, 'pending']
    );

    const decisionDate = decision_type !== 'pending' ? new Date() : null;

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE decisions 
         SET decision_type = $1, status = $1, decided_by_email = $2, decided_by_name = $3, 
             decision_date = $4, notes = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [decision_type, user?.email || 'demo@company.com', user?.name || 'Demo User', 
         decisionDate, notes || null, existing.rows[0].id]
      );
      res.json(result.rows[0]);
    } else {
      const result = await db.query(
        `INSERT INTO decisions (tool_id, decision_type, status, decided_by_email, decided_by_name, due_date, decision_date, notes)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [toolId, decision_type, user?.email || 'demo@company.com', user?.name || 'Demo User',
         tool.rows[0].renewal_date, decisionDate, notes || null]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error creating decision:', error);
    res.status(500).json({ error: 'Failed to create decision' });
  }
});

export default router;
