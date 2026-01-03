import {IAuthService} from "./auth_service";
import {User} from "./user";
import { AuthClient, GoTrueClient } from "@supabase/auth-js";

export class Supabase implements IAuthService {
  private auth: GoTrueClient = null!;
  private _loggedIn: boolean = false;

  public constructor() {
    const supabaseURL = import.meta.env.VITE_SUPABASE_URL
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    this.auth = new AuthClient({
      url: `${supabaseURL}/auth/v1`,
      headers: {
        accept: 'json',
        apikey: supabasePublishableKey,
      },
    });

    this.auth.onAuthStateChange((e, session) => {
      this._loggedIn = session != null;
    })
  }

  async getUser(): Promise<User> {
    const response = await this.auth.getUser();
    if (response.error != null)
      throw new Error(`Failed to get user: ${response.error.message}`);
    return new User(response.data.user?.email || "", response.data.user.user_metadata?.nickname)
  }

  async signIn(email: string, password: string): Promise<User> {
    const response = await this.auth.signInWithPassword({ password, email });
    if (response.error != null)
      throw new Error(`Sign-in failed: ${response.error.message}`);
    return new User(response.data.user?.email || "", response.data.user.user_metadata?.nickname)
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  async signUp(email: string, password: string, nickname: string): Promise<User> {
    const response = await this.auth.signUp({ email, password });
    if (response.error != null)
      throw new Error(`Sign-up failed: ${response.error.message}`);
    await this.auth.updateUser({data: {
        nickname
      }});
    return new User(response.data.user?.email || "", "")
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  updateProfile(param: { avatarUrl?: string; nickname?: string }): Promise<void> {
    return Promise.resolve(undefined);
  }

  uploadAvatar(file: File): Promise<string> {
    return Promise.resolve("");
  }

  public get loggedIn(): boolean {
    return this._loggedIn;
  }

}