-- ============================================================================
-- 003_invoice_tax_id_types.sql
-- The invoices table was missing the seller/buyer tax-id TYPE columns that the
-- Invoice schema, invoice creation insert, and PDF template all rely on.
-- ============================================================================

ALTER TABLE invoices ADD COLUMN seller_tax_id_type text
  CONSTRAINT chk_invoice_seller_tax_id_type CHECK (
    seller_tax_id_type IS NULL OR seller_tax_id_type IN ('eu_vat', 'us_ein', 'gb_vat', 'au_abn', 'other')
  );

ALTER TABLE invoices ADD COLUMN buyer_tax_id_type text
  CONSTRAINT chk_invoice_buyer_tax_id_type CHECK (
    buyer_tax_id_type IS NULL OR buyer_tax_id_type IN ('eu_vat', 'us_ein', 'gb_vat', 'au_abn', 'other')
  );

-- The code (Invoice schema, mapper, updateStatus) expects pdf_generated_at and
-- callback_last_attempt_at; the original schema had neither (it used
-- pdf_storage_path and callback_last_attempt). Reconcile them.
ALTER TABLE invoices ADD COLUMN pdf_generated_at timestamptz;
ALTER TABLE invoices RENAME COLUMN callback_last_attempt TO callback_last_attempt_at;
