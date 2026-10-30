-- ============================================================================
-- 006_platform_mode.sql
-- Platform mode: one API key (org) renders invoices on behalf of many sellers.
-- The caller is the source of truth for numbers, amounts, seller and branding,
-- so those are snapshotted on the invoice. All columns are nullable/defaulted;
-- invoices created without the new request fields behave exactly as before.
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_ref text
    CONSTRAINT chk_invoice_external_ref CHECK (external_ref IS NULL OR length(external_ref) BETWEEN 1 AND 200),
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS locale text
    CONSTRAINT chk_invoice_locale CHECK (locale IS NULL OR locale IN ('en', 'pl', 'de', 'cs', 'sk')),
  -- Seller came from the request (not the org): bank details/logo are then read
  -- from the invoice only, never live from the org.
  ADD COLUMN IF NOT EXISTS seller_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS seller_bank_name text,
  ADD COLUMN IF NOT EXISTS seller_bank_iban text,
  ADD COLUMN IF NOT EXISTS seller_bank_swift text,
  ADD COLUMN IF NOT EXISTS seller_bank_account_number text,
  -- Branding (logo_url may be an https URL or a PNG/JPEG data URI, <= 2,000,000 chars)
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS accent_color text
    CONSTRAINT chk_invoice_accent_color CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN IF NOT EXISTS brand_display_name text,
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS legal_notes jsonb;

-- Bundled templates selected by name need no invoice_templates row.
ALTER TABLE public.invoices ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS vat_label text;

-- Numbers stay unique per org for the org's own sequence. Invoices carrying an
-- external_ref belong to platform sellers that may share numbers ("INV-0001").
DROP INDEX IF EXISTS public.idx_invoices_org_invoice_number;
CREATE UNIQUE INDEX idx_invoices_org_invoice_number
  ON public.invoices (org_id, invoice_number)
  WHERE external_ref IS NULL;

-- Idempotency key: one invoice per (org, external_ref).
CREATE UNIQUE INDEX idx_invoices_org_external_ref
  ON public.invoices (org_id, external_ref)
  WHERE external_ref IS NOT NULL;
