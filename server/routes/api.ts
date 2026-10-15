import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import {
  createCustomer,
  createSale,
  getAllCustomers,
  getCustomerById,
  getCustomerStatement,
  getBusinessSettings,
  updateBusinessSettings,
  updateCustomer,
  setCustomerArchived,
  recordPayment,
  recordAdjustment,
  voidSale,
  voidPayment,
  getAgingReport,
  getDashboardMetrics,
  getItemSuggestions,
  getSaleById,
  CreditLimitExceededError,
} from '../db/ledger';
import {
  CustomerSchema,
  SaleCreateSchema,
  PaymentCreateSchema,
  AdjustmentCreateSchema,
  VoidActionSchema,
  BusinessSettingsSchema,
} from '../../src/shared/schemas';
import { formatDZD } from '../../src/shared/money';
import fs from 'fs';
import path from 'path';

export const apiRouter = Router();

function formatZodErrors(issues: Array<{ message: string; [key: string]: any }>): string {
  return issues.map((i) => i.message).join('. ');
}

// -------------------------------------------------------------
// Business Profile Settings
// -------------------------------------------------------------
apiRouter.get('/business', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const settings = getBusinessSettings(db);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/business', (req: Request, res: Response) => {
  try {
    const parsed = BusinessSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const updated = updateBusinessSettings(db, parsed.data);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Customers
// -------------------------------------------------------------
apiRouter.get('/customers', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const search = req.query.search as string | undefined;
    const includeArchived = req.query.includeArchived === 'true';
    const onlyWithBalance = req.query.onlyWithBalance === 'true';

    const customers = getAllCustomers(db, {
      search,
      includeArchived,
      onlyWithBalance,
    });

    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const customer = getCustomerById(db, id);
    if (!customer) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers', (req: Request, res: Response) => {
  try {
    const parsed = CustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const customer = createCustomer(db, parsed.data);
    res.status(201).json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/customers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = CustomerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const updated = updateCustomer(db, id, parsed.data);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/archive', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const updated = setCustomerArchived(db, id, true);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/unarchive', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const updated = setCustomerArchived(db, id, false);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id/statement', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const fromDate = (req.query.from as string) || null;
    const toDate = (req.query.to as string) || null;

    const db = getDb();
    const statement = getCustomerStatement(db, id, fromDate, toDate);
    res.json(statement);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Sales
// -------------------------------------------------------------
apiRouter.post('/sales', (req: Request, res: Response) => {
  try {
    const parsed = SaleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const result = createSale(db, parsed.data);
    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof CreditLimitExceededError) {
      res.status(409).json({
        error: err.message,
        code: 'CREDIT_LIMIT_EXCEEDED',
        currentBalanceCentimes: err.currentBalanceCentimes,
        creditLimitCentimes: err.creditLimitCentimes,
        newBalanceCentimes: err.newBalanceCentimes,
      });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/sales/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const sale = getSaleById(db, id);
    if (!sale) {
      res.status(404).json({ error: 'Vente introuvable' });
      return;
    }
    res.json(sale);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sales/:id/void', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = VoidActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const voided = voidSale(db, id, parsed.data.reason);
    res.json(voided);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Payments
// -------------------------------------------------------------
apiRouter.post('/payments', (req: Request, res: Response) => {
  try {
    const parsed = PaymentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const payment = recordPayment(db, parsed.data);
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/payments/:id/void', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = VoidActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const voided = voidPayment(db, id, parsed.data.reason);
    res.json(voided);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Adjustments
// -------------------------------------------------------------
apiRouter.post('/adjustments', (req: Request, res: Response) => {
  try {
    const parsed = AdjustmentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodErrors(parsed.error.issues) });
      return;
    }

    const db = getDb();
    const adjustment = recordAdjustment(db, parsed.data);
    res.status(201).json(adjustment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Reports & Dashboard
// -------------------------------------------------------------
apiRouter.get('/dashboard', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const metrics = getDashboardMetrics(db);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/aging', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const buckets = getAgingReport(db);
    res.json(buckets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/suggestions', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const items = getItemSuggestions(db);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Backup & CSV Export
// -------------------------------------------------------------
apiRouter.get('/backup', (req: Request, res: Response) => {
  try {
    const dbPath = process.env.DATABASE_PATH || './data/mizan.db';
    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Fichier de base de données introuvable' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="mizan-backup-${timestamp}.db"`);
    res.setHeader('Content-Type', 'application/x-sqlite3');
    fs.createReadStream(dbPath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/export/csv', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const customers = getAllCustomers(db, { includeArchived: true });

    let csv = 'ID,Nom,Téléphone,Adresse,Solde_DZD,Ventes_Totales_DZD,Paiements_Totaux_DZD,Limite_Crédit_DZD,Statut\n';
    for (const c of customers) {
      const balance = ((c.balance_centimes || 0) / 100).toFixed(2);
      const sales = ((c.total_sales_centimes || 0) / 100).toFixed(2);
      const payments = ((c.total_payments_centimes || 0) / 100).toFixed(2);
      const limit = c.credit_limit_centimes !== null ? (c.credit_limit_centimes / 100).toFixed(2) : 'Illimité';
      const status = c.archived_at ? 'Archivé' : 'Actif';
      
      const escape = (val: string | null) => `"${(val || '').replace(/"/g, '""')}"`;
      csv += `${c.id},${escape(c.name)},${escape(c.phone)},${escape(c.address)},${balance},${sales},${payments},${limit},${status}\n`;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="mizan-clients-${timestamp}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('\uFEFF' + csv); // Include BOM for Excel compatibility
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
