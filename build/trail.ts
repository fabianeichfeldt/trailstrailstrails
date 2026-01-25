
export interface TrailDetails {
  trail_id: string;
  name: string;
  latitude: number;
  longitude: number;
  trail_description?: string;
  rules: string[];
}

export interface Trail {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}
