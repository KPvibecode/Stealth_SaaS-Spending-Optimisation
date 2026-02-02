import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      team_lead_email VARCHAR(255),
      team_lead_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'connected',
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP,
      tenant_id VARCHAR(255),
      last_sync_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detected_tools (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      vendor VARCHAR(255),
      normalized_name VARCHAR(255),
      category VARCHAR(100),
      source_type VARCHAR(50),
      source_id INTEGER,
      cost_monthly DECIMAL(10, 2),
      cost_yearly DECIMAL(10, 2),
      renewal_date DATE,
      billing_cadence VARCHAR(20),
      department_id INTEGER REFERENCES departments(id),
      owner_email VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      is_duplicate BOOLEAN DEFAULT FALSE,
      duplicate_of_id INTEGER REFERENCES detected_tools(id),
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      data_source_id INTEGER REFERENCES data_sources(id),
      transaction_date DATE NOT NULL,
      description TEXT,
      amount DECIMAL(10, 2),
      vendor_raw VARCHAR(255),
      vendor_normalized VARCHAR(255),
      category VARCHAR(100),
      detected_tool_id INTEGER REFERENCES detected_tools(id),
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      detected_tool_id INTEGER REFERENCES detected_tools(id),
      name VARCHAR(255) NOT NULL,
      vendor VARCHAR(255),
      cost_monthly DECIMAL(10, 2),
      renewal_date DATE,
      owner_email VARCHAR(255),
      team_lead_email VARCHAR(255),
      department_id INTEGER REFERENCES departments(id),
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

    CREATE INDEX IF NOT EXISTS idx_detected_tools_normalized_name ON detected_tools(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_transactions_vendor_normalized ON transactions(vendor_normalized);
  `);
  console.log('Database initialized');
}

initDatabase().catch(console.error);
