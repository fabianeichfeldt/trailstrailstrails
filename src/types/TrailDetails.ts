import {Photo} from "./Photo";
import {VideoDetails} from "./VideoDetails";

export class TrailDetails {
    id: string = "";
    rules: string[] = [];
    description: string = "";
    last_update: string = new Date().toString();
    opening_hours: string = "";
    photos: Photo[] = [];
    videos: VideoDetails[] = [];
    public constructor(id: string) {
        this.id = id;
    }
}

