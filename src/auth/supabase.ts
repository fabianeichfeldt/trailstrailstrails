import {IAuthService} from "./auth_service";
import {User} from "./user";
import {createClient, SupabaseClient} from "@supabase/supabase-js"
import * as console from "node:console";

export class Supabase implements IAuthService {
  private supabase: SupabaseClient = null!;
  private _loggedIn: boolean = false;

  public constructor() {
    const supabaseURL = import.meta.env.VITE_SUPABASE_URL
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    this.supabase = createClient(supabaseURL, supabasePublishableKey);
    this.supabase.auth.onAuthStateChange((e, session) => {
      this._loggedIn = session != null;
    });
  }

  async getUser(): Promise<User> {
    const response = await this.supabase.auth.getUser();
    if (response.error != null)
      return User.AnonymousUser;
    return new User(response.data.user?.id || "", response.data.user?.email || "", response.data.user.user_metadata?.nickname, response.data.user.user_metadata?.avatarUrl)
  }

  async signIn(email: string, password: string): Promise<User> {
    let response = await this.supabase.auth.signInWithPassword({ password, email });
    if (response.error != null)
      throw new Error(`Sign-in failed: ${response.error.message}`);
    let user = response.data.user;
    if (response.data.user?.id && response.data.user.user_metadata?.nickname && !response.data.user.user_metadata?.name) {
      user = (await this.supabase.auth.updateUser({data: {
          name: response.data.user.user_metadata.nickname,
          avatar_url: response.data.user.user_metadata.avatarUrl || "",
        }})).data.user ?? user;
    }
    return new User(user?.id || "", user?.email || "", user.user_metadata?.name, user.user_metadata?.avatar_url)
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async signUp(email: string, password: string, nickname: string): Promise<User> {
    const response = await this.supabase.auth.signUp({ email, password });
    if (response.error != null)
      throw new Error(`Sign-up failed: ${response.error.message}`);
    await this.supabase.auth.updateUser({data: {
        nickname
      }});
    return new User("", response.data.user?.email || "", "")
  }

  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.supabase.auth.updateUser({ password: newPassword})
  }

  async updateProfile(param: { avatarUrl?: string; nickname?: string }): Promise<void> {
    await this.supabase.auth.updateUser({ data: param})
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = await this.supabase.auth.getUser();

    const filePath = `${user.data.user?.id}/avatar.webp`
    const response = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (response.error) {
      console.error(response.error)
      alert('Upload failed')
      throw new Error("Upload failed")
    }

    const { data } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return data.publicUrl;
  }

  public get loggedIn(): boolean {
    return this._loggedIn;
  }

  async resetPassword(email: string): Promise<void> {
    await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://trailradar.org/reset_password.html'
    });
  }

  async signInWithGoogle(): Promise<User> {
    await this.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://localhost:5173' }});
    const user = await this.supabase.auth.getUser();
    console.log(user.data.user?.user_metadata);
    return new User(user.data.user?.id || "", user.data.user?.email || "", user.data.user?.user_metadata?.nickname || "", "")
  }

}