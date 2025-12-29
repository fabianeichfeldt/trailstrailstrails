import {User} from "./user";

export interface Auth_service {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getUser(): User;
}

export class DummyAuthService {
  private user: User = User.AnonymousUser;

  public get loggedIn() {
    return this.user !== User.AnonymousUser;
  }

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
