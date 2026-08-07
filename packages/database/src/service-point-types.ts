export type DatabaseServicePointType = 'table' | 'counter';
export type DatabaseServicePointStatus = 'available' | 'open';

export interface DatabaseServicePoint {
  readonly id: string;
  readonly eventId: string;
  readonly label: string;
  readonly type: DatabaseServicePointType;
  readonly status: DatabaseServicePointStatus;
  readonly activeOrderId: string | null;
  readonly activeOrderTotalCents: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}
