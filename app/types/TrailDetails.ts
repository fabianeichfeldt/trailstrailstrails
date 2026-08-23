import {Photo} from "./Photo";
import {VideoDetails} from "./VideoDetails";

export class Like {
  user_id : string = "";
}

export class TrailDetails {
    id: string = "";
    rules: string[] = [];
    description: string = "";
    last_update: string = new Date().toString();
    opening_hours: string = "";
    trail_description: string = "";
    photos: Photo[] = [];
    videos: VideoDetails[] = [];
    likes: Like[] = [];
    // Spot management fields — present for trail-type spots (from trail_details select *)
    status?: 'open' | 'limited' | 'closed' | 'unknown';
    status_until?: string;
    status_hint?: string;
    access_type?: 'free' | 'paid' | 'membership';
    donation_url?: string;
    seasonal_from?: string;
    seasonal_to?: string;
    rain_policy?: 'none' | 'during' | 'after';
    rain_closed_hours?: number;
    public constructor(id: string) {
        this.id = id;
    }
}

