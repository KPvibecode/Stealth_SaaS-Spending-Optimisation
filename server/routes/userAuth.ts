import { Router, Request, Response, NextFunction } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import crypto from 'crypto';
import { db } from '../db/index.js';

const router = Router();

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/user/callback`
  : 'http://localhost:5000/api/user/callback';

const msalConfig = {
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
    clientSecret: MICROSOFT_CLIENT_SECRET
  }
};

const scopes = ['openid', 'profile', 'email', 'User.Read'];

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

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    microsoft_id: string;
    email: string;
    name: string;
    tenant_id: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token;
  
  if (!token) {
    return next();
  }

  try {
    const result = await db.query(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
  }
  
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

router.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

router.get('/login', async (req, res) => {
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
      prompt: 'select_account'
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

router.get('/callback', async (req, res) => {
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

    const account = tokenResponse.account;
    if (!account) {
      return res.redirect('/?error=no_account');
    }

    const microsoftId = account.localAccountId || account.homeAccountId;
    const email = account.username;
    const name = account.name || email;
    const tenantId = account.tenantId || 'unknown';

    let userId: number;
    const existingUser = await db.query(
      'SELECT id FROM users WHERE microsoft_id = $1',
      [microsoftId]
    );

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      await db.query(
        'UPDATE users SET last_login_at = NOW(), name = $1, email = $2 WHERE id = $3',
        [name, email, userId]
      );
    } else {
      const newUser = await db.query(
        `INSERT INTO users (microsoft_id, email, name, tenant_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [microsoftId, email, name, tenantId]
      );
      userId = newUser.rows[0].id;
    }

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, sessionToken, expiresAt]
    );

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || !!process.env.REPLIT_DEV_DOMAIN,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.redirect('/?login=success');
  } catch (error) {
    console.error('Callback error:', error);
    res.redirect('/?error=auth_failed');
  }
});

router.post('/logout', async (req: AuthenticatedRequest, res) => {
  const token = req.cookies?.session_token;
  
  if (token) {
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
  
  res.clearCookie('session_token', { path: '/' });
  res.json({ success: true });
});

export default router;
