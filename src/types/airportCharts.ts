export type ChartType = "TAXI" | "SID" | "STAR" | "APPROACH";
export type ChartSource = "COMMUNITY";

export interface ChartCalibrationPoint {
  x: number;
  y: number;
  lat: number;
  lon: number;
}

export interface ChartCalibration {
  points: ChartCalibrationPoint[];
}

export interface AirportChart {
  id?: string;
  icao: string;
  chartType: ChartType;
  chartName: string;
  chartUrl: string;
  chartCalibration?: ChartCalibration | null;
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
