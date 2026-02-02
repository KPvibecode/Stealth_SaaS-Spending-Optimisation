import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { db } from '../db/index.js';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

interface AmexTransaction {
  date: string;
  description: string;
  amount: number;
  cardMember?: string;
}

const SAAS_KEYWORDS = [
  'subscription', 'saas', 'software', 'cloud', 'monthly', 'annual', 'recurring',
  'slack', 'zoom', 'dropbox', 'salesforce', 'hubspot', 'zendesk', 'intercom',
  'github', 'gitlab', 'atlassian', 'jira', 'confluence', 'notion', 'figma',
  'adobe', 'canva', 'mailchimp', 'sendgrid', 'twilio', 'stripe', 'aws',
  'google', 'microsoft', 'office', 'linkedin', 'docusign', 'asana', 'monday',
  'trello', 'airtable', 'zapier', 'datadog', 'newrelic', 'pagerduty',
  'okta', 'auth0', 'cloudflare', 'vercel', 'heroku', 'netlify'
];

function normalizeVendorName(description: string): string {
  let cleaned = description
    .replace(/\*+/g, ' ')
    .replace(/[0-9]{4,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length > 2);
  const vendorName = words.slice(0, 3).join(' ');
  
  return vendorName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function isSaasTransaction(description: string): boolean {
  const lower = description.toLowerCase();
  return SAAS_KEYWORDS.some(keyword => lower.includes(keyword));
}

function detectBillingCadence(transactions: AmexTransaction[]): string {
  if (transactions.length < 2) return 'unknown';
  
  const dates = transactions.map(t => new Date(t.date).getTime()).sort();
  const gaps: number[] = [];
  
  for (let i = 1; i < dates.length; i++) {
    gaps.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24));
  }
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  
  if (avgGap >= 25 && avgGap <= 35) return 'monthly';
  if (avgGap >= 85 && avgGap <= 95) return 'quarterly';
  if (avgGap >= 350 && avgGap <= 380) return 'yearly';
  
  return 'irregular';
}

function categorizeVendor(name: string): string {
  const lower = name.toLowerCase();
  
  if (/slack|zoom|teams|meet|webex/.test(lower)) return 'Communication';
  if (/salesforce|hubspot|pipedrive|crm/.test(lower)) return 'CRM';
  if (/jira|asana|monday|trello|notion|clickup/.test(lower)) return 'Project Management';
  if (/github|gitlab|bitbucket|aws|azure|gcp|heroku|vercel/.test(lower)) return 'Development';
  if (/figma|adobe|canva|sketch/.test(lower)) return 'Design';
  if (/mailchimp|sendgrid|hubspot|intercom/.test(lower)) return 'Marketing';
  if (/okta|auth0|cloudflare|security/.test(lower)) return 'Security';
  if (/datadog|newrelic|splunk|pagerduty/.test(lower)) return 'Monitoring';
  
  return 'Other';
}

router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const dataSourceResult = await db.query(
      `INSERT INTO data_sources (type, name, status) VALUES ($1, $2, $3) RETURNING id`,
      ['amex_csv', `Amex Upload - ${new Date().toISOString().split('T')[0]}`, 'connected']
    );
    const dataSourceId = dataSourceResult.rows[0].id;

    const transactions: AmexTransaction[] = [];
    const fileContent = req.file.buffer.toString();
    
    const parser = Readable.from(fileContent).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      })
    );

    for await (const record of parser) {
      const date = record['Date'] || record['Transaction Date'] || record['date'];
      const description = record['Description'] || record['Merchant'] || record['description'] || '';
      const amountStr = record['Amount'] || record['amount'] || '0';
      const amount = Math.abs(parseFloat(amountStr.replace(/[$,]/g, '')));
      
      if (date && description && amount > 0) {
        transactions.push({ date, description, amount });
      }
    }

    const vendorGroups: Map<string, AmexTransaction[]> = new Map();
    
    for (const txn of transactions) {
      const normalized = normalizeVendorName(txn.description);
      if (!vendorGroups.has(normalized)) {
        vendorGroups.set(normalized, []);
      }
      vendorGroups.get(normalized)!.push(txn);
    }

    let saasDetected = 0;
    let transactionsStored = 0;

    for (const [normalizedVendor, txns] of vendorGroups) {
      const firstTxn = txns[0];
      const isSaas = isSaasTransaction(firstTxn.description) || txns.length >= 2;
      
      if (!isSaas) continue;

      const totalSpend = txns.reduce((sum, t) => sum + t.amount, 0);
      const avgMonthly = totalSpend / Math.max(txns.length, 1);
      const cadence = detectBillingCadence(txns);
      const category = categorizeVendor(firstTxn.description);

      const existing = await db.query(
        'SELECT id FROM detected_tools WHERE normalized_name = $1',
        [normalizedVendor]
      );

      let detectedToolId: number;

      if (existing.rows.length > 0) {
        detectedToolId = existing.rows[0].id;
        await db.query(
          `UPDATE detected_tools SET 
            cost_monthly = COALESCE(cost_monthly, 0) + $1,
            billing_cadence = $2,
            updated_at = NOW()
          WHERE id = $3`,
          [avgMonthly, cadence, detectedToolId]
        );
      } else {
        const insertResult = await db.query(
          `INSERT INTO detected_tools 
            (name, vendor, normalized_name, category, source_type, source_id, cost_monthly, billing_cadence, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            firstTxn.description.split('*')[0].trim(),
            firstTxn.description,
            normalizedVendor,
            category,
            'amex_csv',
            dataSourceId,
            avgMonthly,
            cadence,
            'active'
          ]
        );
        detectedToolId = insertResult.rows[0].id;
        saasDetected++;
      }

      for (const txn of txns) {
        await db.query(
          `INSERT INTO transactions 
            (data_source_id, transaction_date, description, amount, vendor_raw, vendor_normalized, category, detected_tool_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [dataSourceId, txn.date, txn.description, txn.amount, txn.description, normalizedVendor, category, detectedToolId]
        );
        transactionsStored++;
      }
    }

    await db.query(
      'UPDATE data_sources SET last_sync_at = NOW() WHERE id = $1',
      [dataSourceId]
    );

    res.json({
      success: true,
      message: `Processed ${transactions.length} transactions`,
      saasDetected,
      transactionsStored,
      dataSourceId
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, type, name, status, last_sync_at, created_at 
       FROM data_sources 
       ORDER BY created_at DESC 
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

export default router;
