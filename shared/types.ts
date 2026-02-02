export interface Subscription {
  id: number;
  name: string;
  vendor: string;
  cost_monthly: number;
  renewal_date: string;
  owner_email: string;
  team_lead_email: string;
  status: 'active' | 'pending_review' | 'cancelled' | 'downgraded';
  usage_score: number;
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: number;
  subscription_id: number;
  decision_type: 'renew' | 'cancel' | 'downgrade' | 'review';
  decided_by: string;
  decision_date: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
}
