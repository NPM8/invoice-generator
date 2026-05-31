-- ============================================================================
-- 004_invoice_payment.sql
-- Record how an invoice was paid (e.g. by card at checkout in the calling app),
-- shown on the invoice instead of bank-transfer details. No payment processing
-- happens here — this is just recorded payment information.
-- ============================================================================

ALTER TABLE invoices ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid'
  CONSTRAINT chk_invoice_payment_status CHECK (payment_status IN ('paid', 'unpaid'));

ALTER TABLE invoices ADD COLUMN payment_method text
  CONSTRAINT chk_invoice_payment_method CHECK (
    payment_method IS NULL OR payment_method IN ('card', 'bank_transfer', 'cash', 'other')
  );

ALTER TABLE invoices ADD COLUMN paid_at timestamptz;
ALTER TABLE invoices ADD COLUMN card_last4 text
  CONSTRAINT chk_invoice_card_last4 CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$');
