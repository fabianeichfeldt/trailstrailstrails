import {DummyAuthService} from './auth_service';

import "/src/auth/avatar.css"
import "/src/auth/auth_modal.css"
import {User} from "./user";
import {DomEvent} from "leaflet";
import stopPropagation = DomEvent.stopPropagation;

type UserChangedHandler = (u: User) => Promise<void>;

export class Auth {
  private backdrop: HTMLElement | null = null;
  private errorBox: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private avatarBtn: HTMLElement | null = null;
  private loginBtn: HTMLElement | null = null;
  private signUpBtn: HTMLElement | null = null;
  private userChangedHandlers: UserChangedHandler[] = [];
  private auth = new DummyAuthService();
  private dropdown: HTMLElement | null = null;

  public async init() {
    await this.loadAuthTemplate();
    this.backdrop = document.querySelector('.auth-backdrop');
    this.errorBox = this.backdrop?.querySelector('.auth-error') as HTMLElement;
    this.avatarBtn = document.getElementById("user-avatar-btn");
    this.dropdown = document.getElementById('user-dropdown');
    this.loginBtn = document.getElementById('login-btn');
    this.signUpBtn = document.getElementById('signup-btn');
    this.closeModal();

    this.form = document.getElementById('auth-form') as HTMLFormElement;

    this.onUserChanged((u) => {
      if (!this.avatarBtn) return Promise.resolve();
      if (this.auth.loggedIn)
        this.showAvatarButton();
      else
        this.hideAvatarButton();
      this.avatarBtn.innerHTML = u.avatarHTML;
      return Promise.resolve();
    });
    this.triggerUserChanged();

    this.loginBtn?.addEventListener('click', async () => {
      this.openModal();
    })

    this.dropdown?.querySelector('#logout-btn')!
      .addEventListener('click', async () => {
        await this.auth.signOut();
        this.triggerUserChanged();
        document.dispatchEvent(new CustomEvent('auth:logout'));
        this.dropdown?.classList.add('hidden');
      });
    this.avatarBtn?.addEventListener('click', (e) => {
      this.openProfileMenu();
      stopPropagation(e);
    });

    this.form.addEventListener('submit', async (e) => {
      if (!this.form) return;
      e.preventDefault();
      this.clearAuthError();
      const email = (this.form[0] as HTMLInputElement).value;
      const password = (this.form[1] as HTMLInputElement).value;

      try {
        this.setLoading(true);
        const user = await this.auth.signIn(email, password);
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

    document.addEventListener('click', () => {
      this.dropdown?.classList.add('hidden');
    });
  }

  private showAvatarButton() {
    this.avatarBtn?.classList.remove('hidden');
    this.loginBtn?.classList.add('hidden');
    this.signUpBtn?.classList.add('hidden');
  }

  private hideAvatarButton() {
    this.avatarBtn?.classList.add('hidden');
    this.loginBtn?.classList.remove('hidden');
    this.signUpBtn?.classList.remove('hidden');
  }

  private openProfileMenu() {
    this.dropdown?.classList.toggle('hidden');
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
