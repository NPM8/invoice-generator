-- ============================================================================
-- 001_initial_schema.sql
-- Complete PostgreSQL schema for the invoicing service
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TRIGGER FUNCTION: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: organizations
-- ============================================================================

CREATE TABLE organizations (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text        NOT NULL,
  legal_name                  text        NOT NULL,
  address_line1               text,
  address_line2               text,
  city                        text,
  state                       text,
  postal_code                 text,
  country_code                text        NOT NULL
    CONSTRAINT chk_org_country_code CHECK (length(country_code) = 2),
  tax_id                      text,
  tax_id_type                 text
    CONSTRAINT chk_org_tax_id_type CHECK (
      tax_id_type IS NULL OR tax_id_type IN ('eu_vat', 'us_ein', 'gb_vat', 'au_abn', 'other')
    ),
  email                       text,
  phone                       text,
  website                     text,

  -- Banking details
  bank_name                   text,
  bank_iban                   text,
  bank_swift                  text,
  bank_account_number         text,

  -- Branding & defaults
  logo_url                    text,
  default_currency            text        NOT NULL DEFAULT 'EUR'
    CONSTRAINT chk_org_currency CHECK (length(default_currency) = 3),
  default_payment_terms_days  int         NOT NULL DEFAULT 30,
  invoice_prefix              text        NOT NULL DEFAULT 'INV',
  next_invoice_number         int         NOT NULL DEFAULT 1,

  -- Timestamps
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- TABLE: api_keys
-- ============================================================================

CREATE TABLE api_keys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_prefix      text        NOT NULL,
  key_hash        text        NOT NULL,
  name            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_api_key_status CHECK (status IN ('active', 'revoked', 'expired')),
  scopes          text[]      NOT NULL DEFAULT '{}'::text[],
  rate_limit      int         DEFAULT 1000,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  created_by      text
);

-- ============================================================================
-- TABLE: invoice_templates
-- ============================================================================

CREATE TABLE invoice_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  version         int         NOT NULL DEFAULT 1,
  is_default      boolean     NOT NULL DEFAULT false,
  component_code  text        NOT NULL,
  props_schema    jsonb,
  status          text        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_template_status CHECK (status IN ('active', 'archived')),

  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- TABLE: invoices
-- ============================================================================

CREATE TABLE invoices (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid          NOT NULL REFERENCES organizations(id),
  template_id             uuid          NOT NULL REFERENCES invoice_templates(id),
  invoice_number          text          NOT NULL,

  -- Seller snapshot
  seller_name             text          NOT NULL,
  seller_address          text          NOT NULL,
  seller_tax_id           text,
  seller_country_code     text          NOT NULL,

  -- Buyer
  buyer_name              text          NOT NULL,
  buyer_address           text          NOT NULL,
  buyer_tax_id            text,
  buyer_country_code      text          NOT NULL,
  buyer_email             text,

  -- Financial
  currency                text          NOT NULL,
  subtotal                numeric(15,2) NOT NULL,
  total_vat               numeric(15,2) NOT NULL,
  total                   numeric(15,2) NOT NULL,
  vat_summary             jsonb         NOT NULL DEFAULT '[]',
  is_reverse_charge       boolean       NOT NULL DEFAULT false,

  -- Status
  status                  text          NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_invoice_status CHECK (
      status IN ('pending', 'processing', 'completed', 'failed')
    ),

  -- Dates
  issue_date              date          NOT NULL,
  due_date                date          NOT NULL,
  CONSTRAINT chk_invoice_due_date CHECK (due_date >= issue_date),

  -- Callback
  callback_url            text,
  callback_status         text          DEFAULT 'none'
    CONSTRAINT chk_invoice_callback_status CHECK (
      callback_status IN ('none', 'pending', 'delivered', 'failed')
    ),
  callback_attempts       int           NOT NULL DEFAULT 0,
  callback_last_attempt   timestamptz,

  -- Output
  pdf_url                 text,
  pdf_storage_path        text,

  -- Extra
  notes                   text,
  terms                   text,
  metadata                jsonb         DEFAULT '{}',

  -- Timestamps
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- TABLE: invoice_items
-- ============================================================================

CREATE TABLE invoice_items (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position          int           NOT NULL,
  description       text          NOT NULL,
  quantity          numeric(15,4) NOT NULL,
  unit              text          DEFAULT 'pcs',
  unit_price        numeric(15,4) NOT NULL,
  discount_percent  numeric(5,2)  NOT NULL DEFAULT 0,
  vat_rate          numeric(5,2)  NOT NULL,
  vat_amount        numeric(15,2) NOT NULL,
  net_amount        numeric(15,2) NOT NULL,
  gross_amount      numeric(15,2) NOT NULL,

  -- Timestamps
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE: jobs
-- ============================================================================

CREATE TABLE jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  queue_name      text        NOT NULL,
  bullmq_job_id   text,
  status          text        NOT NULL DEFAULT 'queued'
    CONSTRAINT chk_job_status CHECK (
      status IN ('queued', 'processing', 'completed', 'failed', 'retrying')
    ),
  attempts        int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 5,
  last_error      text,
  started_at      timestamptz,
  completed_at    timestamptz,

  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- api_keys
CREATE INDEX idx_api_keys_org_id ON api_keys(org_id);
CREATE UNIQUE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- invoice_templates
CREATE INDEX idx_invoice_templates_org_id ON invoice_templates(org_id);
CREATE UNIQUE INDEX idx_invoice_templates_one_default_per_org
  ON invoice_templates(org_id, is_default)
  WHERE is_default = true AND status = 'active';

-- invoices
CREATE INDEX idx_invoices_org_id ON invoices(org_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE UNIQUE INDEX idx_invoices_org_invoice_number ON invoices(org_id, invoice_number);

-- invoice_items
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE UNIQUE INDEX idx_invoice_items_invoice_position ON invoice_items(invoice_id, position);

-- jobs
CREATE INDEX idx_jobs_invoice_id ON jobs(invoice_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_queue_status ON jobs(queue_name, status);

-- ============================================================================
-- FUNCTION: generate_invoice_number
-- Atomically increments the org's counter and returns a formatted number
-- e.g. 'INV-000001'
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_current_number int;
BEGIN
  UPDATE organizations
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = p_org_id
  RETURNING invoice_prefix, next_invoice_number - 1
  INTO v_prefix, v_current_number;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
  END IF;

  RETURN v_prefix || '-' || lpad(v_current_number::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- service_role policies: full access (service_role bypasses RLS by default,
-- but explicit policies ensure clarity and allow force-RLS scenarios)
-- ---------------------------------------------------------------------------

-- organizations
CREATE POLICY "service_role_all_organizations"
  ON organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- api_keys
CREATE POLICY "service_role_all_api_keys"
  ON api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- invoice_templates
CREATE POLICY "service_role_all_invoice_templates"
  ON invoice_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- invoices
CREATE POLICY "service_role_all_invoices"
  ON invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- invoice_items
CREATE POLICY "service_role_all_invoice_items"
  ON invoice_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- jobs
CREATE POLICY "service_role_all_jobs"
  ON jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Org-scoped policies using JWT claim: auth.jwt() ->> 'org_id'
-- These apply to the authenticated/anon roles for potential future use.
-- ---------------------------------------------------------------------------

-- organizations: users can only see their own org
CREATE POLICY "org_select_organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_update_organizations"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (id::text = auth.jwt() ->> 'org_id');

-- api_keys: scoped to org
CREATE POLICY "org_select_api_keys"
  ON api_keys
  FOR SELECT
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_insert_api_keys"
  ON api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_update_api_keys"
  ON api_keys
  FOR UPDATE
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_delete_api_keys"
  ON api_keys
  FOR DELETE
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id');

-- invoice_templates: scoped to org (or global templates where org_id IS NULL)
CREATE POLICY "org_select_invoice_templates"
  ON invoice_templates
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id::text = auth.jwt() ->> 'org_id'
  );

CREATE POLICY "org_insert_invoice_templates"
  ON invoice_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_update_invoice_templates"
  ON invoice_templates
  FOR UPDATE
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_delete_invoice_templates"
  ON invoice_templates
  FOR DELETE
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id');

-- invoices: scoped to org
CREATE POLICY "org_select_invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_insert_invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

CREATE POLICY "org_update_invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (org_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (org_id::text = auth.jwt() ->> 'org_id');

-- invoice_items: scoped via parent invoice's org
CREATE POLICY "org_select_invoice_items"
  ON invoice_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

CREATE POLICY "org_insert_invoice_items"
  ON invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

CREATE POLICY "org_update_invoice_items"
  ON invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

CREATE POLICY "org_delete_invoice_items"
  ON invoice_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- jobs: scoped via parent invoice's org
CREATE POLICY "org_select_jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = jobs.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

CREATE POLICY "org_update_jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = jobs.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = jobs.invoice_id
        AND invoices.org_id::text = auth.jwt() ->> 'org_id'
    )
  );
