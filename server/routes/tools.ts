import { Router } from 'express';
import Fuse from 'fuse.js';
import { db } from '../db/index.js';
import { requireAuth } from './userAuth.js';

const router = Router();

router.use(requireAuth as any);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        dt.*,
        d.name as department_name,
        d.team_lead_email as assigned_team_lead,
        d.team_lead_name as team_lead_name
      FROM detected_tools dt
      LEFT JOIN departments d ON dt.department_id = d.id
      WHERE dt.is_duplicate = FALSE OR dt.is_duplicate IS NULL
      ORDER BY dt.cost_monthly DESC NULLS LAST, dt.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Failed to fetch detected tools' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_tools,
        COUNT(DISTINCT category) as categories,
        COALESCE(SUM(cost_monthly), 0) as total_monthly_spend,
        COUNT(CASE WHEN department_id IS NULL THEN 1 END) as unassigned,
        COUNT(CASE WHEN is_duplicate = TRUE THEN 1 END) as duplicates
      FROM detected_tools
      WHERE is_duplicate = FALSE OR is_duplicate IS NULL
    `);

    const byCategory = await db.query(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(cost_monthly), 0) as spend
      FROM detected_tools
      WHERE is_duplicate = FALSE OR is_duplicate IS NULL
      GROUP BY category
      ORDER BY spend DESC
    `);

    const bySource = await db.query(`
      SELECT source_type, COUNT(*) as count
      FROM detected_tools
      WHERE is_duplicate = FALSE OR is_duplicate IS NULL
      GROUP BY source_type
    `);

    res.json({
      ...stats.rows[0],
      byCategory: byCategory.rows,
      bySource: bySource.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/deduplicate', async (req, res) => {
  try {
    const tools = await db.query(`
      SELECT id, name, normalized_name, vendor, cost_monthly
      FROM detected_tools
      WHERE is_duplicate = FALSE OR is_duplicate IS NULL
    `);

    const fuse = new Fuse(tools.rows, {
      keys: ['normalized_name', 'name'],
      threshold: 0.3,
      includeScore: true
    });

    const duplicatesFound: { original: number; duplicate: number; similarity: number }[] = [];
    const processed = new Set<number>();

    for (const tool of tools.rows) {
      if (processed.has(tool.id)) continue;

      const matches = fuse.search(tool.normalized_name);
      
      for (const match of matches) {
        if (match.item.id !== tool.id && !processed.has(match.item.id)) {
          if (match.score && match.score < 0.3) {
            duplicatesFound.push({
              original: tool.id,
              duplicate: match.item.id,
              similarity: 1 - (match.score || 0)
            });
            processed.add(match.item.id);

            await db.query(
              `UPDATE detected_tools 
               SET is_duplicate = TRUE, duplicate_of_id = $1 
               WHERE id = $2`,
              [tool.id, match.item.id]
            );
          }
        }
      }
      processed.add(tool.id);
    }

    res.json({
      success: true,
      duplicatesFound: duplicatesFound.length,
      details: duplicatesFound
    });
  } catch (error) {
    console.error('Deduplication error:', error);
    res.status(500).json({ error: 'Failed to run deduplication' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { department_id, owner_email, status, category } = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (department_id !== undefined) {
      updates.push(`department_id = $${paramIndex++}`);
      values.push(department_id);
    }
    if (owner_email !== undefined) {
      updates.push(`owner_email = $${paramIndex++}`);
      values.push(owner_email);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE detected_tools SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM transactions WHERE detected_tool_id = $1', [id]);
    await db.query('DELETE FROM detected_tools WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

export default router;
