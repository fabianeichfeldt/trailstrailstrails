export class Photo {
    id: string = "";
    url: string = "";
    created_at: string = "";
    profiles: {
      display_name: string
      avatar_url: string
    } = {display_name: "", avatar_url: ""};
}