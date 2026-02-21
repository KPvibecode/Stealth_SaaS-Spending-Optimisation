import { Router } from 'express';
import { Resend } from 'resend';
import crypto from 'crypto';
import { db } from '../db/index.js';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const REMINDER_DAYS = [30, 15, 7];

function getAppUrl(): string {
  const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
  return `https://${domain}`;
}

function formatCurrency(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRiskLevel(daysLeft: number, cost: number): { level: string; color: string } {
  if (daysLeft <= 7) return { level: 'CRITICAL', color: '#e74c3c' };
  if (daysLeft <= 15 || cost >= 3000) return { level: 'HIGH', color: '#f39c12' };
  if (daysLeft <= 30 || cost >= 1000) return { level: 'MEDIUM', color: '#3498db' };
  return { level: 'LOW', color: '#27ae60' };
}

async function createActionToken(toolId: number, action: string, recipientEmail: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO email_action_tokens (token, tool_id, action, recipient_email, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [token, toolId, action, recipientEmail, expiresAt]
  );

  return token;
}

function buildEmailHtml(tool: any, daysLeft: number, approveUrl: string, cancelUrl: string, reviewUrl: string): string {
  const risk = getRiskLevel(daysLeft, Number(tool.cost_monthly));
  const renewalDate = new Date(tool.renewal_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const urgencyText = daysLeft <= 0
    ? `<span style="color: #e74c3c; font-weight: 700;">OVERDUE — renewal date has passed!</span>`
    : daysLeft <= 7
      ? `<span style="color: #e74c3c; font-weight: 700;">${daysLeft} days until renewal</span>`
      : `<span style="font-weight: 600;">${daysLeft} days until renewal</span>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a1a2e; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">SaaS Spend Manager</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Renewal Decision Required</p>
    </div>

    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${risk.color}15; color: ${risk.color}; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">
        ${risk.level} RISK
      </div>

      <h2 style="margin: 0 0 4px; color: #333; font-size: 24px;">${tool.name}</h2>
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">${tool.vendor}</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Monthly Cost</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 16px; color: #333;">${formatCurrency(Number(tool.cost_monthly))}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Renewal Date</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #333;">${renewalDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time Remaining</td>
            <td style="padding: 8px 0; text-align: right;">${urgencyText}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Category</td>
            <td style="padding: 8px 0; text-align: right; color: #333;">${tool.category}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Department</td>
            <td style="padding: 8px 0; text-align: right; color: #333;">${tool.department_name || 'Unassigned'}</td>
          </tr>
        </table>
      </div>

      <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        A renewal decision is needed for <strong>${tool.name}</strong>. Please choose one of the actions below. 
        Your decision will be recorded automatically — no need to log in.
      </p>

      <div style="text-align: center; margin-bottom: 16px;">
        <a href="${approveUrl}" style="display: inline-block; padding: 14px 32px; background: #27ae60; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 0 6px;">
          &#10003; Approve Renewal
        </a>
      </div>

      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${reviewUrl}" style="display: inline-block; padding: 12px 28px; background: #3498db; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 6px;">
          Needs Review
        </a>
        <a href="${cancelUrl}" style="display: inline-block; padding: 12px 28px; background: #e74c3c; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 6px;">
          Cancel Subscription
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #aaa; font-size: 12px; text-align: center; margin: 0;">
        This notification was sent by SaaS Spend Manager. 
        If a decision has already been made, subsequent reminders will not be sent.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildConfirmationHtml(tool: any, action: string): string {
  const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
    approved: { label: 'Renewal Approved', color: '#27ae60', icon: '&#10003;' },
    cancelled: { label: 'Subscription Cancelled', color: '#e74c3c', icon: '&#10007;' },
    under_review: { label: 'Marked for Review', color: '#3498db', icon: '&#128269;' }
  };
  const info = actionLabels[action] || { label: action, color: '#333', icon: '' };

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 500px; margin: 40px auto; padding: 20px;">
    <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: ${info.color}; color: white; font-size: 28px; line-height: 64px; margin: 0 auto 20px;">${info.icon}</div>
      <h2 style="color: #333; margin: 0 0 8px;">${info.label}</h2>
      <p style="color: #666; margin: 0 0 24px;">Your decision for <strong>${tool.name}</strong> has been recorded.</p>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: left;">
        <p style="margin: 4px 0; color: #555;"><strong>Tool:</strong> ${tool.name}</p>
        <p style="margin: 4px 0; color: #555;"><strong>Vendor:</strong> ${tool.vendor}</p>
        <p style="margin: 4px 0; color: #555;"><strong>Cost:</strong> ${formatCurrency(Number(tool.cost_monthly))}/mo</p>
        <p style="margin: 4px 0; color: #555;"><strong>Decision:</strong> ${info.label}</p>
      </div>
      <p style="color: #aaa; font-size: 12px; margin-top: 24px;">No further reminder emails will be sent for this tool.</p>
    </div>
  </div>
</body>
</html>`;
}

router.get('/action/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await db.query(
      `SELECT eat.*, dt.name as tool_name, dt.vendor, dt.cost_monthly, dt.category, dt.renewal_date,
              dep.name as department_name
       FROM email_action_tokens eat
       JOIN detected_tools dt ON eat.tool_id = dt.id
       LEFT JOIN departments dep ON dt.department_id = dep.id
       WHERE eat.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('<html><body style="font-family: sans-serif; text-align: center; padding: 40px;"><h2>Link not found</h2><p>This action link is invalid or has expired.</p></body></html>');
    }

    const tokenRow = result.rows[0];

    if (tokenRow.used_at) {
      const toolForDisplay = { ...tokenRow, name: tokenRow.tool_name };
      return res.send(buildConfirmationHtml(toolForDisplay, tokenRow.action));
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(410).send('<html><body style="font-family: sans-serif; text-align: center; padding: 40px;"><h2>Link expired</h2><p>This action link has expired. Please log in to the application to make your decision.</p></body></html>');
    }

    const existingDecision = await db.query(
      `SELECT id, status FROM decisions WHERE tool_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tokenRow.tool_id]
    );

    const decisionDate = new Date();

    if (existingDecision.rows.length > 0 && existingDecision.rows[0].status === 'pending') {
      await db.query(
        `UPDATE decisions 
         SET decision_type = $1, status = $1, decided_by_email = $2, decided_by_name = $3, 
             decision_date = $4, notes = $5, updated_at = NOW()
         WHERE id = $6`,
        [tokenRow.action, tokenRow.recipient_email, tokenRow.recipient_email, 
         decisionDate, 'Decision made via email notification', existingDecision.rows[0].id]
      );
    } else if (!existingDecision.rows.length || existingDecision.rows[0].status === 'pending') {
      await db.query(
        `INSERT INTO decisions (tool_id, decision_type, status, decided_by_email, decided_by_name, due_date, decision_date, notes)
         VALUES ($1, $2, $2, $3, $3, $4, $5, $6)`,
        [tokenRow.tool_id, tokenRow.action, tokenRow.recipient_email,
         tokenRow.renewal_date, decisionDate, 'Decision made via email notification']
      );
    }

    await db.query(
      `UPDATE email_action_tokens SET used_at = NOW() WHERE token = $1`,
      [token]
    );

    await db.query(
      `UPDATE email_action_tokens SET expires_at = NOW() 
       WHERE tool_id = $1 AND used_at IS NULL AND token != $2`,
      [tokenRow.tool_id, token]
    );

    const toolForDisplay = { ...tokenRow, name: tokenRow.tool_name };
    res.send(buildConfirmationHtml(toolForDisplay, tokenRow.action));
  } catch (error) {
    console.error('Error processing email action:', error);
    res.status(500).send('<html><body style="font-family: sans-serif; text-align: center; padding: 40px;"><h2>Something went wrong</h2><p>Please try again or log in to the application.</p></body></html>');
  }
});

async function sendReminderEmail(tool: any, daysLeft: number, reminderTier: number, recipientEmail: string): Promise<boolean> {
  try {
    const appUrl = getAppUrl();

    const [approveToken, cancelToken, reviewToken] = await Promise.all([
      createActionToken(tool.id, 'approved', recipientEmail),
      createActionToken(tool.id, 'cancelled', recipientEmail),
      createActionToken(tool.id, 'under_review', recipientEmail),
    ]);

    const approveUrl = `${appUrl}/api/notifications/action/${approveToken}`;
    const cancelUrl = `${appUrl}/api/notifications/action/${cancelToken}`;
    const reviewUrl = `${appUrl}/api/notifications/action/${reviewToken}`;

    const urgencyPrefix = daysLeft <= 7 ? '🚨 URGENT: ' : daysLeft <= 15 ? '⚠️ ' : '';
    const subject = `${urgencyPrefix}${tool.name} renewal decision needed — ${daysLeft} days left`;

    const html = buildEmailHtml(tool, daysLeft, approveUrl, cancelUrl, reviewUrl);

    await resend.emails.send({
      from: 'SaaS Manager <onboarding@resend.dev>',
      to: recipientEmail,
      subject,
      html
    });

    await db.query(
      `INSERT INTO notification_logs (tool_id, notification_type, recipient_email, days_before_renewal)
       VALUES ($1, $2, $3, $4)`,
      [tool.id, 'renewal_reminder', recipientEmail, reminderTier]
    );

    console.log(`Sent ${reminderTier}-day tier reminder (${daysLeft}d left) for ${tool.name} to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send reminder for ${tool.name}:`, error);
    return false;
  }
}

async function checkAndSendNotifications(): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;

  try {
    const tools = await db.query(`
      SELECT 
        dt.*,
        d.name as department_name,
        d.team_lead_email,
        d.team_lead_name,
        dec.status as decision_status
      FROM detected_tools dt
      LEFT JOIN departments d ON dt.department_id = d.id
      LEFT JOIN LATERAL (
        SELECT status FROM decisions 
        WHERE decisions.tool_id = dt.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dec ON true
      WHERE dt.renewal_date IS NOT NULL
        AND (dt.is_duplicate = FALSE OR dt.is_duplicate IS NULL)
        AND dt.status = 'active'
    `);

    for (const tool of tools.rows) {
      const daysUntilRenewal = Math.ceil(
        (new Date(tool.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (tool.decision_status && tool.decision_status !== 'pending') {
        skipped++;
        continue;
      }

      const recipientEmail = tool.team_lead_email || tool.owner_email;
      if (!recipientEmail) {
        skipped++;
        continue;
      }

      for (const reminderDay of REMINDER_DAYS) {
        if (daysUntilRenewal <= reminderDay && daysUntilRenewal > (reminderDay === 30 ? 15 : reminderDay === 15 ? 7 : 0)) {
          const alreadySent = await db.query(
            `SELECT id FROM notification_logs 
             WHERE tool_id = $1 AND days_before_renewal = $2 AND recipient_email = $3`,
            [tool.id, reminderDay, recipientEmail]
          );

          if (alreadySent.rows.length > 0) {
            skipped++;
            continue;
          }

          const success = await sendReminderEmail(tool, daysUntilRenewal, reminderDay, recipientEmail);
          if (success) {
            sent++;
          } else {
            errors++;
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error in notification check:', error);
    errors++;
  }

  return { sent, skipped, errors };
}

router.post('/check', async (req, res) => {
  try {
    const results = await checkAndSendNotifications();
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Error running notification check:', error);
    res.status(500).json({ error: 'Failed to run notification check' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT nl.*, dt.name as tool_name, dt.vendor
      FROM notification_logs nl
      JOIN detected_tools dt ON nl.tool_id = dt.id
      ORDER BY nl.sent_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

export { checkAndSendNotifications };
export default router;
