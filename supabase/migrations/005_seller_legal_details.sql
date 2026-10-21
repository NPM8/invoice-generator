-- Legal seller information is organization configuration and is snapshotted
-- when an invoice is issued. Existing invoices and numbering are untouched.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS local_tax_id text,
  ADD COLUMN IF NOT EXISTS registration_details text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS seller_company_registration_number text,
  ADD COLUMN IF NOT EXISTS seller_local_tax_id text,
  ADD COLUMN IF NOT EXISTS seller_registration_details text;
