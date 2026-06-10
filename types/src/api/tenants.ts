import { Tenant } from '../entities/tenant';
import { TenantWeights } from '../scoring/matchScore';

// POST /api/v1/tenants
export interface CreateTenantRequest {
  name: string;
  alpha?: number;
  beta?: number;
}
export type CreateTenantResponse = Tenant;

// GET /api/v1/tenants/:id
export type GetTenantResponse = Tenant;

// PUT /api/v1/tenants/:id/weights
export type UpdateTenantWeightsRequest = TenantWeights;
export type UpdateTenantWeightsResponse = Tenant;
