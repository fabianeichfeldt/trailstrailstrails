import {User} from "./user";
import {IAuthService} from "./auth_service";

export class DummyAuthService implements IAuthService{
  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
      throw new Error("Method not implemented.");
  }
  updateProfile(param: { avatarUrl?: string; nickname?: string; }) : Promise<void> {
      throw new Error("Method not implemented.");
  }
  private user: User = User.AnonymousUser;

  public uploadAvatar(file: File): Promise<string> {
      throw new Error("Method not implemented.");
  }

  public get loggedIn() {
    return this.user !== User.AnonymousUser;
  }

  async signIn(email: string, password: string) : Promise<User> {
    this.user = new User("", email, "Trailradar", "/src/assets/logo.webp");
    await new Promise(resolve => setTimeout(resolve, 3000));
    return this.user;
  }

  async signUp(email: string, password: string) {
    this.user = new User("", email, "Trailradar", "/src/assets/logo.webp");
    return this.user;
  }

  async signOut() {
    this.user = User.AnonymousUser;
  }

  getUser() {
    return Promise.resolve(this.user);
  }
}
