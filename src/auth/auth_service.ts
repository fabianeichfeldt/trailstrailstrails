export interface User {
  id: string;
  email: string;
  avatarUrl?: string;
}

export interface Auth_service {
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getUser(): User | null;
}

// src/auth/Auth_service.ts
export class DummyAuthService {
  private user: any = null;

  async signIn(email: string) {
    this.user = { id: '1', email };
    await new Promise(resolve => setTimeout(resolve, 3000));
    return this.user;
  }

  async signUp(email: string) {
    this.user = { id: '1', email };
    return this.user;
  }

  async signOut() {
    this.user = null;
  }

  getUser() {
    return this.user;
  }
}
