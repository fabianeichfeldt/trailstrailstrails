export class Comment {
    id: number = 0;
    created_at: string = "";
    spot_id: string = "";
    // null once the author deleted their account (FK ON DELETE SET NULL)
    user_id: string | null = "";
    comment_text: string = "";
    profiles: {
      display_name: string
      avatar_url: string
    } | null = {display_name: "", avatar_url: ""};
}
