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
  public static get AnonymousUser() : User {
    return new User("dummy@google.com");
  }
}

export interface Auth_service {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getUser(): User;
}

export class DummyAuthService {
  private user: User = User.AnonymousUser;

  async signIn(email: string) : Promise<User> {
    this.user = new User(email, "/src/assets/logo.webp");
    await new Promise(resolve => setTimeout(resolve, 3000));
    return this.user;
  }

  async signUp(email: string) {
    this.user = new User(email, "/src/assets/logo.webp");
    return this.user;
  }

  async signOut() {
    this.user = User.AnonymousUser;
  }

  getUser() {
    return this.user;
  }
}
