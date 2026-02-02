import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

async function getAccessToken(): Promise<string | null> {
  const result = await db.query(
    "SELECT access_token, token_expires_at FROM data_sources WHERE type = 'microsoft_entra' AND status = 'connected' ORDER BY created_at DESC LIMIT 1"
  );
  
  if (result.rows.length === 0) return null;
  
  const { access_token, token_expires_at } = result.rows[0];
  
  if (new Date(token_expires_at) < new Date()) {
    return null;
  }
  
  return access_token;
}

async function fetchFromGraph(endpoint: string, accessToken: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status}`);
  }
  
  return response.json();
}

router.post('/sync-enterprise-apps', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Microsoft not connected or token expired' });
    }

    const appsData = await fetchFromGraph('/applications', accessToken);
    const servicePrincipals = await fetchFromGraph('/servicePrincipals', accessToken);
    
    const apps = [...(appsData.value || []), ...(servicePrincipals.value || [])];
    
    let imported = 0;
    
    for (const app of apps) {
      const normalizedName = normalizeVendorName(app.displayName);
      
      const existing = await db.query(
        'SELECT id FROM detected_tools WHERE normalized_name = $1 AND source_type = $2',
        [normalizedName, 'microsoft_entra']
      );
      
      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO detected_tools (name, vendor, normalized_name, category, source_type, status, raw_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            app.displayName,
            app.publisherName || app.displayName,
            normalizedName,
            categorizeApp(app),
            'microsoft_entra',
            'active',
            JSON.stringify(app)
          ]
        );
        imported++;
      }
    }

    await db.query(
      "UPDATE data_sources SET last_sync_at = NOW() WHERE type = 'microsoft_entra'"
    );

    res.json({ 
      success: true, 
      imported,
      total: apps.length,
      message: `Imported ${imported} new apps from Microsoft Entra`
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync enterprise apps' });
  }
});

function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/inc|llc|corp|ltd|limited|software|app|cloud|online|enterprise/g, '')
    .trim();
}

function categorizeApp(app: any): string {
  const name = (app.displayName || '').toLowerCase();
  const tags = (app.tags || []).join(' ').toLowerCase();
  const combined = `${name} ${tags}`;
  
  if (combined.includes('slack') || combined.includes('teams') || combined.includes('zoom') || combined.includes('meet')) {
    return 'Communication';
  }
  if (combined.includes('salesforce') || combined.includes('hubspot') || combined.includes('crm')) {
    return 'CRM';
  }
  if (combined.includes('jira') || combined.includes('asana') || combined.includes('monday') || combined.includes('project')) {
    return 'Project Management';
  }
  if (combined.includes('github') || combined.includes('gitlab') || combined.includes('bitbucket') || combined.includes('dev')) {
    return 'Development';
  }
  if (combined.includes('figma') || combined.includes('sketch') || combined.includes('adobe') || combined.includes('design')) {
    return 'Design';
  }
  if (combined.includes('aws') || combined.includes('azure') || combined.includes('gcp') || combined.includes('cloud')) {
    return 'Infrastructure';
  }
  if (combined.includes('security') || combined.includes('auth') || combined.includes('okta') || combined.includes('identity')) {
    return 'Security';
  }
  
  return 'Other';
}

export default router;
