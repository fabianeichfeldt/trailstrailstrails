import {IAuthService} from "./auth_service";
import {User} from "./user";
import {createClient, SupabaseClient} from "@supabase/supabase-js"

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
      throw new Error(`Failed to get user: ${response.error.message}`);
    return new User(response.data.user?.email || "", response.data.user.user_metadata?.nickname, response.data.user.user_metadata?.avatarUrl)
  }

  async signIn(email: string, password: string): Promise<User> {
    const response = await this.supabase.auth.signInWithPassword({ password, email });
    if (response.error != null)
      throw new Error(`Sign-in failed: ${response.error.message}`);
    return new User(response.data.user?.email || "", response.data.user.user_metadata?.nickname, response.data.user.user_metadata?.avatarUrl)
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
    return new User(response.data.user?.email || "", "")
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    return Promise.resolve(undefined);
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

}