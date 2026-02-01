import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      vendor VARCHAR(255),
      cost_monthly DECIMAL(10, 2),
      renewal_date DATE,
      owner_email VARCHAR(255),
      team_lead_email VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      usage_score INTEGER DEFAULT 0,
      risk_level VARCHAR(20) DEFAULT 'low',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER REFERENCES subscriptions(id),
      decision_type VARCHAR(50) NOT NULL,
      decided_by VARCHAR(255),
      decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'pending'
    );
  `);
  console.log('Database initialized');
}

initDatabase().catch(console.error);
