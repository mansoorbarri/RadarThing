export type ChartType = "TAXI" | "SID" | "STAR" | "APPROACH" | "GENERAL";
export type ChartSource = "COMMUNITY";

export interface ChartCalibration {
  p1PixelX: number;
  p1PixelY: number;
  p1Lat: number;
  p1Lon: number;
  p2PixelX: number;
  p2PixelY: number;
  p2Lat: number;
  p2Lon: number;
  calibratedBy: string;
}

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
  calibration?: ChartCalibration | null;
}

export interface ChartsByType {
  TAXI: AirportChart[];
  SID: AirportChart[];
  STAR: AirportChart[];
  APPROACH: AirportChart[];
  GENERAL: AirportChart[];
}
