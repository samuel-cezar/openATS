declare global {
  namespace Express {
    interface Request {
      /** Tenant id from X-Tenant-Id, set by the tenant middleware in server.ts. */
      tenantId: string;
    }
  }
}

export {};
