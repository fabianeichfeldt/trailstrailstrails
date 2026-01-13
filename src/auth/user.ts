export class User {
  public static AnonymousUser: User = new User("-1","dummy@google.com", "Dummy");
  email: string = "";
  avatarUrl?: string = "";
  avatarHTML: string = "";
  nickname: string = "";
  id: string = "";

  public constructor(id: string, email: string, nickName: string, avatarUrl?: string) {
    this.email = email;
    this.avatarUrl = avatarUrl;
    this.nickname = nickName;
    this.id = id;
    this.avatarHTML = `
  <div class="user-avatar">
    ${
      avatarUrl
        ? `<img src="${avatarUrl}" alt="User Avatar" />`
        : `<span class="avatar-fallback" aria-hidden="true"></span>`
    }
  </div>
`;
  }
}