import { Router } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { db } from '../db/index.js';

const router = Router();

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/microsoft/callback`
  : 'http://localhost:5000/api/auth/microsoft/callback';

const msalConfig = {
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
    clientSecret: MICROSOFT_CLIENT_SECRET
  }
};

const scopes = [
  'https://graph.microsoft.com/.default'
];

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient() {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return null;
  }
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

router.get('/microsoft/status', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM data_sources WHERE type = 'microsoft_entra' AND status = 'connected' ORDER BY created_at DESC LIMIT 1"
    );
    
    if (result.rows.length > 0) {
      const source = result.rows[0];
      res.json({
        connected: true,
        lastSync: source.last_sync_at,
        tenantId: source.tenant_id,
        accountName: source.name
      });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    res.json({ connected: false });
  }
});

router.get('/microsoft/login', async (req, res) => {
  const client = getMsalClient();
  
  if (!client) {
    return res.status(400).json({ 
      error: 'Microsoft credentials not configured',
      message: 'Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables'
    });
  }

  try {
    const authUrl = await client.getAuthCodeUrl({
      scopes,
      redirectUri: REDIRECT_URI,
      prompt: 'consent'
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft auth error:', error);
    res.status(500).json({ error: 'Failed to initiate Microsoft login' });
  }
});

router.get('/microsoft/callback', async (req, res) => {
  const client = getMsalClient();
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(error as string));
  }

  if (!code || !client) {
    return res.redirect('/?error=missing_code');
  }

  try {
    const tokenResponse = await client.acquireTokenByCode({
      code: code as string,
      scopes,
      redirectUri: REDIRECT_URI
    });

    const tenantId = tokenResponse.tenantId || 'unknown';
    const expiresAt = tokenResponse.expiresOn;

    const existing = await db.query(
      "SELECT id FROM data_sources WHERE type = 'microsoft_entra' LIMIT 1"
    );

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE data_sources 
         SET access_token = $1, token_expires_at = $2, tenant_id = $3, last_sync_at = NOW(), status = 'connected'
         WHERE type = 'microsoft_entra'`,
        [tokenResponse.accessToken, expiresAt, tenantId]
      );
    } else {
      await db.query(
        `INSERT INTO data_sources (type, name, status, access_token, token_expires_at, tenant_id, last_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        ['microsoft_entra', 'Microsoft Entra', 'connected', tokenResponse.accessToken, expiresAt, tenantId]
      );
    }

    res.redirect('/?connected=microsoft');
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect('/?error=token_exchange_failed');
  }
});

router.post('/microsoft/disconnect', async (req, res) => {
  try {
    await db.query(
      "UPDATE data_sources SET status = 'disconnected' WHERE type = 'microsoft_entra'"
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
