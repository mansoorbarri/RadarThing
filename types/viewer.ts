export interface ViewerResponse {
  activeViewers: number;
  hasViewers: boolean;
  lastActivity: string | null;
}

export interface ViewerRegisterRequest {
  viewerId?: string;
}

export interface ViewerRegisterResponse {
  success: boolean;
  viewerId: string;
  activeViewers: number;
}
