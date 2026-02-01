import express from 'express';
import cors from 'cors';
import { db } from './db/index.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/subscriptions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
