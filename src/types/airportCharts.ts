export interface AirportChart {
  name: string;
  taxi_chart_url: string;
  info_url?: string;
}

export type AirportChartIndex = Record<string, AirportChart>;