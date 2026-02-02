import express from 'express';
import cors from 'cors';
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import graphRoutes from './routes/graph.js';
import uploadRoutes from './routes/upload.js';
import toolsRoutes from './routes/tools.js';
import departmentsRoutes from './routes/departments.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/departments', departmentsRoutes);

app.get('/api/subscriptions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.get('/api/data-sources', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, type, name, status, last_sync_at, created_at
      FROM data_sources
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
