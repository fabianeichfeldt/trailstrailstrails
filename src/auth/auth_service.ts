import {User} from "./user";

export interface IAuthService {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string, nickname: string): Promise<User>;
  signOut(): Promise<void>;
  getUser(): Promise<User>;
  uploadAvatar(file: File): Promise<string>;
  updatePassword(oldPassword: string, newPassword: string): Promise<void>;
  updateProfile(param: { avatarUrl?: string, nickname?: string }): Promise<void>;
  loggedIn: boolean
  resetPassword(email: string): Promise<void>;
  signInWithGoogle(): Promise<User>;
  uploadTrailPhoto(file: File, trailId: string): Promise<string>;
}