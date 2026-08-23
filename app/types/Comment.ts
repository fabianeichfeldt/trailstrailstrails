export class Comment {
    id: number = 0;
    created_at: string = "";
    spot_id: string = "";
    user_id: string = "";
    comment_text: string = "";
    profiles: {
      display_name: string
      avatar_url: string
    } = {display_name: "", avatar_url: ""};
}
