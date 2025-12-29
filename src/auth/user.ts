export class User {
  email: string = "";
  avatarUrl?: string = "";
  avatarHTML: string = "";

  public constructor(email: string, avatarUrl?: string) {
    this.email = email;
    this.avatarUrl = avatarUrl;
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

  public static get AnonymousUser(): User {
    return new User("dummy@google.com");
  }
}