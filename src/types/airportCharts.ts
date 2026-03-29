export type ChartType = "TAXI" | "SID" | "STAR" | "APPROACH";
export type ChartSource = "COMMUNITY";

export interface AirportChart {
  id?: string;
  icao: string;
  chartType: ChartType;
  chartName: string;
  chartUrl: string;
  imageKey?: string | null;
  source: ChartSource;
  isApproved?: boolean;
  uploadedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: number | null;
  createdAt?: number;
}

export interface ChartsByType {
  TAXI: AirportChart[];
  SID: AirportChart[];
  STAR: AirportChart[];
  APPROACH: AirportChart[];
}
