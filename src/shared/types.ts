export type PaymentMethod = 'espèces' | 'chèque' | 'virement' | 'autre';

export type AdjustmentReason = 
  | 'Solde initial'
  | 'Remise'
  | 'Perte/Radiation'
  | 'Correction';

export type VatMode = 'none' | 'exclusive';

export interface BusinessSettings {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  nif: string | null; // Numéro d'Identification Fiscale
  nis: string | null; // Numéro d'Identification Statistique
  rc: string | null;  // Registre de Commerce
  ai: string | null;  // Article d'Imposition
  default_currency: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  credit_limit_centimes: number | null; // limit in centimes (1 DZD = 100 centimes)
  payment_terms_days: number;           // default 30 days
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Computed fields from ledger
  balance_centimes?: number;
  total_sales_centimes?: number;
  total_payments_centimes?: number;
  total_adjustments_centimes?: number;
  last_activity_at?: string | null;
  last_payment_at?: string | null;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  label: string;
  unit: string;                     // e.g. 'pcs', 'kg', 'carton', 'sac', 'L'
  quantity_thousandths: number;     // 2.5 units = 2500
  unit_price_centimes: number;      // in centimes
  vat_rate_bp: number | null;       // basis points, e.g. 1900 = 19%, 900 = 9%
  line_total_centimes: number;      // integer centimes
}

export interface Sale {
  id: number;
  customer_id: number;
  customer_name?: string;
  sale_number: string;              // e.g. 'V-2026-0001'
  sold_at: string;                  // ISO UTC
  due_date: string;                 // ISO UTC
  note: string | null;
  vat_mode: VatMode;
  subtotal_ht_centimes: number;
  vat_total_centimes: number;
  total_ttc_centimes: number;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface Payment {
  id: number;
  customer_id: number;
  customer_name?: string;
  amount_centimes: number;          // strictly positive integer
  paid_at: string;                  // ISO UTC
  method: PaymentMethod;
  reference: string | null;         // e.g. numéro chèque / virement
  note: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface Adjustment {
  id: number;
  customer_id: number;
  customer_name?: string;
  amount_centimes: number;          // signed: positive = debit (client owes more), negative = credit (remise, etc.)
  reason: AdjustmentReason;
  note: string;                     // required note
  adjusted_at: string;              // ISO UTC
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  entity: string;
  entity_id: number;
  action: 'create' | 'update' | 'void' | 'archive' | 'unarchive' | 'override_credit_limit';
  at: string;
  details_json: string | null;
}

export interface StatementRow {
  id: string; // unique composite key for table row
  type: 'sale' | 'payment' | 'adjustment';
  date: string;
  reference: string;
  label: string;
  details?: string;
  debit_centimes: number;   // amounts that increase customer debt (sales, positive adjustments)
  credit_centimes: number;  // amounts that decrease customer debt (payments, negative adjustments)
  running_balance_centimes: number;
  is_voided: boolean;
  void_reason?: string | null;
}

export interface CustomerStatement {
  customer: Customer;
  business: BusinessSettings;
  from_date: string | null;
  to_date: string | null;
  opening_balance_centimes: number;
  closing_balance_centimes: number;
  total_debit_centimes: number;
  total_credit_centimes: number;
  rows: StatementRow[];
  generated_at: string;
}

export interface AgingBucket {
  customer_id: number;
  customer_name: string;
  phone: string | null;
  total_balance_centimes: number;
  current_centimes: number;       // not overdue
  days_1_30_centimes: number;     // 1 to 30 days overdue
  days_31_60_centimes: number;    // 31 to 60 days overdue
  days_61_90_centimes: number;    // 61 to 90 days overdue
  days_90_plus_centimes: number;  // > 90 days overdue
}

export interface DashboardMetrics {
  total_outstanding_centimes: number;
  sales_today_centimes: number;
  payments_today_centimes: number;
  debtors_count: number;
  overdue_total_centimes: number;
  total_customers_count: number;
  top_debtors: {
    id: number;
    name: string;
    phone: string | null;
    balance_centimes: number;
    credit_limit_centimes: number | null;
    days_overdue_max: number;
  }[];
  recent_activity: {
    id: string;
    type: 'sale' | 'payment' | 'adjustment';
    customer_name: string;
    amount_centimes: number;
    date: string;
    summary: string;
  }[];
}
