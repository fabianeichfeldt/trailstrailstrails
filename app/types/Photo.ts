export class Photo {
    id: string = "";
    url: string = "";
    created_at: string = "";
    // null once the uploader deleted their account (FK ON DELETE SET NULL)
    creator: string | null = "";
    profiles: {
      display_name: string
      avatar_url: string
    } | null = {display_name: "", avatar_url: ""};
}