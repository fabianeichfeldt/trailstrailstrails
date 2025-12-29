import {DummyAuthService} from './auth_service';

import "/src/auth/avatar.css"
import "/src/auth/auth_modal.css"
import {User} from "./user";

type UserChangedHandler = (u: User) => Promise<void>;

export class Auth {
  private backdrop: HTMLElement | null = null;
  private errorBox: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private userChangedHandlers: UserChangedHandler[] = [];
  private auth = new DummyAuthService();

  public async init() {
    await this.loadAuthTemplate();
    this.backdrop = document.querySelector('.auth-backdrop');
    this.errorBox = this.backdrop?.querySelector('.auth-error') as HTMLElement;
    this.closeModal();

    this.triggerUserChanged();
    this.form = document.getElementById('auth-form') as HTMLFormElement;

    this.form.addEventListener('submit', async (e) => {
      if (!this.form) return;
      e.preventDefault();
      this.clearAuthError();
      const email = (this.form[0] as HTMLInputElement).value;

      try {
        this.setLoading(true);
        const user = await this.auth.signIn(email);
        this.backdrop?.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
      } catch (e) {
        this.showAuthError('Fehler beim Anmelden. Bitte versuche es erneut.');
      } finally {
        this.setLoading(false);
        this.triggerUserChanged();
      }
    });

    this.backdrop?.querySelector('.cancel')!
      .addEventListener('click', this.closeModal);

    this.backdrop?.querySelector('.google')!
      .addEventListener('click', () => {
        console.log('Google login (dummy)');
      });
    this.backdrop?.querySelector('#forgot-password')!
      .addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Forgot password clicked (UI only)');
      });
  }

  private triggerUserChanged() {
    this.userChangedHandlers.slice(0).forEach((handler) => handler(this.auth.getUser()));
  }

  public onUserChanged(handler: UserChangedHandler) {
    this.userChangedHandlers.push(handler);
  }

  public openModal() {
    this.backdrop?.classList.remove("hidden");
    console.log("open", this.backdrop)
  }

  public closeModal() {
    this.backdrop = document.querySelector('.auth-backdrop');
    this.backdrop?.classList.add("hidden");
    console.log("close", this.backdrop)
  }

  private setLoading(state: boolean) {
    this.form?.querySelector('button.primary')!
      .classList.toggle('loading', state);
  }

  private async loadAuthTemplate(): Promise<void> {
    if (document.getElementById('auth-modal'))
      return; // already loaded

    const res = await fetch('/src/auth/sign_in_modal.html');
    const html = await res.text();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    const template = wrapper.querySelector('div');
    if (!template) {
      throw new Error('Auth template not found');
    }

    document.body.appendChild(template);
  }

  private showAuthError(message: string) {
    if (!this.errorBox) return;
    this.errorBox.textContent = message;
    this.errorBox.classList.remove('hidden');
  }

  private clearAuthError() {
    this.errorBox?.classList.add('hidden');
  }
}
