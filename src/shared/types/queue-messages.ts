export type QueueMessage =
  | { type: "pdf-generation"; invoiceId: string }
  | { type: "callback-delivery"; invoiceId: string }
