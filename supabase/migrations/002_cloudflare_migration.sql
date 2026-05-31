-- ============================================================================
-- 002_cloudflare_migration.sql
-- Schema changes for Cloudflare Workers migration
-- ============================================================================

-- Add compiled_code column for pre-compiled template TSX -> JS
ALTER TABLE invoice_templates ADD COLUMN compiled_code TEXT;

-- Remove BullMQ-specific job ID column (CF Queues assigns its own IDs)
ALTER TABLE jobs DROP COLUMN bullmq_job_id;
