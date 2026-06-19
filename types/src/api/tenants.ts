import type { Tenant } from '../entities/tenant';
import type { TenantWeights } from '../scoring/matchScore';

// POST /api/v1/tenants
export interface CreateTenantRequest {
  name: string;
  alpha?: number;
  beta?: number;
}
export type CreateTenantResponse = Tenant;

// GET /api/v1/tenants/:id
export type GetTenantResponse = Tenant;

// GET /api/v1/tenants/current — tenant keyed by the X-Tenant-Id header
export type GetCurrentTenantResponse = Tenant;

// PUT /api/v1/tenants/:id/weights
export type UpdateTenantWeightsRequest = TenantWeights;
export type UpdateTenantWeightsResponse = Tenant;
