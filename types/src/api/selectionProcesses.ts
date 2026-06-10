import type { ISODateString } from '../entities/common';
import type { SelectionProcess } from '../entities/selectionProcess';
import type { DeletedResponse } from './common';

// POST /api/v1/selection-processes
export interface CreateSelectionProcessRequest {
  name?: string;
  description?: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
}
export type CreateSelectionProcessResponse = SelectionProcess;

// GET /api/v1/selection-processes
export type ListSelectionProcessesResponse = SelectionProcess[];

// GET /api/v1/selection-processes/:id
export type GetSelectionProcessResponse = SelectionProcess;

// PUT /api/v1/selection-processes/:id
export type UpdateSelectionProcessRequest = Partial<CreateSelectionProcessRequest>;
export type UpdateSelectionProcessResponse = SelectionProcess;

// DELETE /api/v1/selection-processes/:id
export type DeleteSelectionProcessResponse = DeletedResponse;
