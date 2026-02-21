import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from './userAuth.js';

const router = Router();

router.use(requireAuth as any);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.*,
        COUNT(dt.id) as tool_count,
        COALESCE(SUM(dt.cost_monthly), 0) as total_spend
      FROM departments d
      LEFT JOIN detected_tools dt ON dt.department_id = d.id 
        AND (dt.is_duplicate = FALSE OR dt.is_duplicate IS NULL)
      GROUP BY d.id
      ORDER BY d.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/', async (req, res) => {
  const { name, team_lead_email, team_lead_name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO departments (name, team_lead_email, team_lead_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, team_lead_email, team_lead_name]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, team_lead_email, team_lead_name } = req.body;

  try {
    const result = await db.query(
      `UPDATE departments 
       SET name = COALESCE($1, name),
           team_lead_email = COALESCE($2, team_lead_email),
           team_lead_name = COALESCE($3, team_lead_name)
       WHERE id = $4 RETURNING *`,
      [name, team_lead_email, team_lead_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('UPDATE detected_tools SET department_id = NULL WHERE department_id = $1', [id]);
    await db.query('DELETE FROM departments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

router.post('/auto-assign', async (req, res) => {
  try {
    const departments = await db.query('SELECT * FROM departments');
    
    if (departments.rows.length === 0) {
      return res.status(400).json({ error: 'No departments configured. Create departments first.' });
    }

    const categoryToDepartment: Record<string, number> = {};
    for (const dept of departments.rows) {
      const deptName = dept.name.toLowerCase();
      if (deptName.includes('engineering') || deptName.includes('dev')) {
        categoryToDepartment['Development'] = dept.id;
        categoryToDepartment['Infrastructure'] = dept.id;
        categoryToDepartment['Monitoring'] = dept.id;
      }
      if (deptName.includes('design') || deptName.includes('product')) {
        categoryToDepartment['Design'] = dept.id;
        categoryToDepartment['Project Management'] = dept.id;
      }
      if (deptName.includes('sales') || deptName.includes('revenue')) {
        categoryToDepartment['CRM'] = dept.id;
      }
      if (deptName.includes('marketing')) {
        categoryToDepartment['Marketing'] = dept.id;
      }
      if (deptName.includes('it') || deptName.includes('security') || deptName.includes('ops')) {
        categoryToDepartment['Security'] = dept.id;
        categoryToDepartment['Communication'] = dept.id;
      }
    }

    let assigned = 0;
    const tools = await db.query(
      `SELECT id, category FROM detected_tools 
       WHERE department_id IS NULL AND (is_duplicate = FALSE OR is_duplicate IS NULL)`
    );

    for (const tool of tools.rows) {
      const deptId = categoryToDepartment[tool.category];
      if (deptId) {
        await db.query(
          'UPDATE detected_tools SET department_id = $1 WHERE id = $2',
          [deptId, tool.id]
        );
        assigned++;
      }
    }

    res.json({
      success: true,
      assigned,
      total: tools.rows.length,
      message: `Auto-assigned ${assigned} tools to departments`
    });
  } catch (error) {
    console.error('Auto-assign error:', error);
    res.status(500).json({ error: 'Failed to auto-assign tools' });
  }
});

export default router;
