import { z } from 'zod';

// Maximum amount: 10 billion DZD = 1,000,000,000,000 centimes
const MAX_AMOUNT_CENTIMES = 1_000_000_000_000;
// Maximum quantity: 1,000,000 units = 1,000,000,000 thousandths
const MAX_QUANTITY_THOUSANDTHS = 1_000_000_000;

export const CustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Le nom doit comporter au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  phone: z
    .string()
    .trim()
    .max(30, 'Le numéro de téléphone est trop long')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  address: z
    .string()
    .trim()
    .max(200, "L'adresse ne peut pas dépasser 200 caractères")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  notes: z
    .string()
    .trim()
    .max(500, 'Les remarques ne peuvent pas dépasser 500 caractères')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  credit_limit_centimes: z
    .number()
    .int('La limite de crédit doit être un entier en centimes')
    .min(0, 'La limite de crédit ne peut pas être négative')
    .max(MAX_AMOUNT_CENTIMES, 'La limite de crédit dépasse le montant maximum autorisé')
    .nullable()
    .optional(),
  payment_terms_days: z
    .number()
    .int('Le délai de paiement doit être en jours entiers')
    .min(0, 'Le délai ne peut pas être négatif')
    .max(365, 'Le délai ne peut pas dépasser 365 jours')
    .default(30),
});

export const SaleItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Le libellé de l'article ne peut pas être vide")
    .max(120, 'Le libellé est trop long (max 120 caractères)'),
  unit: z
    .string()
    .trim()
    .min(1, "L'unité est requise")
    .max(20, "L'unité est trop longue")
    .default('pcs'),
  quantity_thousandths: z
    .number()
    .int('La quantité doit être un entier en millièmes')
    .positive('La quantité doit être strictement supérieure à zéro')
    .max(MAX_QUANTITY_THOUSANDTHS, 'La quantité est trop élevée'),
  unit_price_centimes: z
    .number()
    .int('Le prix unitaire doit être un entier en centimes')
    .min(0, 'Le prix unitaire ne peut pas être négatif')
    .max(MAX_AMOUNT_CENTIMES, 'Le prix unitaire est trop élevé'),
  vat_rate_bp: z
    .number()
    .int('Le taux de TVA doit être un entier en points de base')
    .refine((val) => val === 0 || val === 900 || val === 1900, {
      message: 'Le taux de TVA en Algérie doit être 0%, 9% ou 19%',
    })
    .nullable()
    .optional()
    .default(null),
});

export const SaleCreateSchema = z.object({
  customer_id: z
    .number()
    .int('Identifiant client invalide')
    .positive('Identifiant client invalide'),
  sold_at: z
    .string()
    .datetime({ message: 'Date de vente invalide (format ISO requis)' }),
  due_date: z
    .string()
    .datetime({ message: "Date d'échéance invalide (format ISO requis)" })
    .optional(),
  note: z
    .string()
    .trim()
    .max(300, 'La note ne peut pas dépasser 300 caractères')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  vat_mode: z.enum(['none', 'exclusive'] as const).default('none'),
  items: z
    .array(SaleItemSchema)
    .min(1, 'La vente doit comporter au moins un article'),
  is_cash_sale: z.boolean().default(false),
  cash_payment_method: z.enum(['espèces', 'chèque', 'virement', 'autre'] as const).default('espèces'),
  cash_payment_reference: z.string().trim().max(100).nullable().optional(),
  override_credit_limit: z.boolean().default(false),
  idempotency_key: z.string().trim().optional(),
});

export const PaymentCreateSchema = z.object({
  customer_id: z
    .number()
    .int('Identifiant client invalide')
    .positive('Identifiant client invalide'),
  amount_centimes: z
    .number()
    .int('Le montant doit être un entier en centimes')
    .positive('Le montant du paiement doit être strictement supérieur à zéro')
    .max(MAX_AMOUNT_CENTIMES, 'Le montant dépasse la limite autorisée'),
  paid_at: z
    .string()
    .datetime({ message: 'Date de paiement invalide (format ISO requis)' }),
  method: z.enum(['espèces', 'chèque', 'virement', 'autre'] as const),
  reference: z
    .string()
    .trim()
    .max(100, 'La référence ne peut pas dépasser 100 caractères')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  note: z
    .string()
    .trim()
    .max(300, 'La note ne peut pas dépasser 300 caractères')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  idempotency_key: z.string().trim().optional(),
});

export const AdjustmentCreateSchema = z.object({
  customer_id: z
    .number()
    .int('Identifiant client invalide')
    .positive('Identifiant client invalide'),
  amount_centimes: z
    .number()
    .int('Le montant doit être un entier en centimes')
    .refine((val) => val !== 0, {
      message: "Le montant de l'ajustement ne peut pas être égal à zéro",
    })
    .refine((val) => Math.abs(val) <= MAX_AMOUNT_CENTIMES, {
      message: 'Le montant dépasse la limite autorisée',
    }),
  reason: z.enum(['Solde initial', 'Remise', 'Perte/Radiation', 'Correction'] as const),
  note: z
    .string()
    .trim()
    .min(3, "La note explicative doit comporter au moins 3 caractères (obligatoire pour l'audit)")
    .max(300, 'La note ne peut pas dépasser 300 caractères'),
  adjusted_at: z
    .string()
    .datetime({ message: "Date d'ajustement invalide (format ISO requis)" }),
  idempotency_key: z.string().trim().optional(),
});

export const VoidActionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Le motif d'annulation doit comporter au moins 3 caractères")
    .max(300, 'Le motif ne peut pas dépasser 300 caractères'),
});

export const BusinessSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'entreprise doit comporter au moins 2 caractères")
    .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),
  address: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  nif: z.string().trim().max(30).nullable().optional(),
  nis: z.string().trim().max(30).nullable().optional(),
  rc: z.string().trim().max(30).nullable().optional(),
  ai: z.string().trim().max(30).nullable().optional(),
  default_currency: z.string().default('DZD'),
});
