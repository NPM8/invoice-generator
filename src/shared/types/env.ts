export interface Env {
  INVOICE_QUEUE: Queue
  INVOICES_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ADMIN_API_KEY: string
  LOG_LEVEL: string
  NODE_ENV: string
}
