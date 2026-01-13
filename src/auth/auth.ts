import "/src/auth/avatar.css"
import "/src/auth/auth_modal.css"
import {User} from "./user";
import {DomEvent} from "leaflet";
import stopPropagation = DomEvent.stopPropagation;
import {IAuthService} from "./auth_service";
import {showToast} from "../toast";

type UserChangedHandler = (u: User) => Promise<void>;

export class Auth {
  private signInModal: HTMLElement | null = null;
  private signUpModal: HTMLElement | null = null;
  private errorBox: HTMLElement | null = null;
  private signInForm: HTMLFormElement | null = null;
  private signUpForm: HTMLFormElement | null = null;
  private avatarBtn: HTMLElement | null = null;
  private loginBtn: HTMLElement | null = null;
  private signUpBtn: HTMLElement | null = null;
  private userChangedHandlers: UserChangedHandler[] = [];
  private auth: IAuthService;
  private dropdown: HTMLElement | null = null;
  private nickname: HTMLElement = null!;

  public constructor(auth: IAuthService) {
    this.auth = auth;
  }
  public async init() {
    await this.loadSignInTemplate();
    await this.loadSignUpTemplate();
    this.signInModal = document.querySelector('#sign-in-modal');
    this.signUpModal = document.querySelector('#sign-up-modal');
    this.errorBox = this.signInModal?.querySelector('.auth-error') as HTMLElement;
    this.avatarBtn = document.getElementById("user-avatar-btn");
    this.dropdown = document.getElementById('user-dropdown');
    this.loginBtn = document.getElementById('login-btn');
    this.signUpBtn = document.getElementById('signup-btn');
    this.signInForm = document.getElementById('auth-form') as HTMLFormElement;
    this.signUpForm = document.getElementById('signup-form') as HTMLFormElement;

    this.onUserChanged(async (u) => {
      if (!this.avatarBtn) return Promise.resolve();
      if (this.auth.loggedIn) {
        this.showAvatarButton();
        const user = await this.auth.getUser();
        this.nickname.innerHTML = user.nickname;
      }
      else
        this.hideAvatarButton();
      this.avatarBtn.innerHTML = u.avatarHTML;
      return Promise.resolve();
    });
    this.triggerUserChanged();

    this.initializeProfileDropdown();

    this.loginBtn?.addEventListener('click', this.openSignInModal);
    this.signUpBtn?.addEventListener('click', this.openSignUpModal);
    this.signInForm.addEventListener('submit', async (e) => await this.signIn(e));
    this.signUpForm.addEventListener('submit', async (e) => await this.signUp(e));

    this.signInModal?.querySelector('.cancel')!
      .addEventListener('click', this.closeSignInModal);
    this.signUpModal?.querySelector('.cancel')!
      .addEventListener('click', this.closeSignUpModal);
    this.signInModal?.querySelector('#switch-to-sign-up')?.
      addEventListener('click', () => {this.closeSignInModal(); this.openSignUpModal();});
    this.signUpModal?.querySelector('#switch-to-login')?.
      addEventListener('click', () => {this.closeSignUpModal(); this.openSignInModal();});

    this.signInModal?.querySelector('.google')!
      .addEventListener('click', () => {
        console.log('Google login (dummy)');
      });
    this.signInModal?.querySelector('#forgot-password')!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('email') as HTMLInputElement).value;
        await this.auth.resetPassword(email);
        showToast("Wir haben dir eine Email gesendet um das Passwort zurück zu setzen.")
        this.closeSignInModal();
      });

    document.addEventListener('click', () => {
      this.dropdown?.classList.add('hidden');
    });
  }

  private initializeProfileDropdown() {
    this.dropdown?.querySelector('#logout-btn')!
      .addEventListener('click', async () => {
        await this.auth.signOut();
        this.triggerUserChanged();
        document.dispatchEvent(new CustomEvent('auth:logout'));
        this.dropdown?.classList.add('hidden');
      });
    this.dropdown?.querySelector('#profile-btn')!
      .addEventListener('click', async () => {
        window.location.href = '/profile.html';
      });
    this.avatarBtn?.addEventListener('click', (e) => {
      this.openProfileMenu();
      stopPropagation(e);
    });
    this.nickname = this.dropdown?.querySelector("#user-nickname")!;
  }

  private async signIn(e: SubmitEvent) {
    if (!this.signInForm) return;
    e.preventDefault();
    this.clearAuthError();
    const email = (this.signInForm[0] as HTMLInputElement).value;
    const password = (this.signInForm[1] as HTMLInputElement).value;

    try {
      this.setLoading(true);
      const user = await this.auth.signIn(email, password);
      this.signInModal?.classList.add('hidden');
      document.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
    } catch (e) {
      this.showAuthError('Fehler beim Anmelden. Bitte versuche es erneut.');
    } finally {
      this.setLoading(false);
      this.triggerUserChanged();
    }
  }

  private async signUp(e: SubmitEvent) {
    if (!this.signUpForm) return;
    const nickname = (this.signUpForm[0] as HTMLInputElement).value;
    const email = (this.signUpForm[1] as HTMLInputElement).value;
    const password = (this.signUpForm[2] as HTMLInputElement).value;
    const passwordConfirmation = (this.signUpForm[3] as HTMLInputElement).value;
    this.clearAuthError();
    if (password !== passwordConfirmation) {
      this.showAuthError('Passwörter stimmen nicht überein');
      return;
    }
    e.preventDefault();
    try {
      this.setLoading(true);
      const user = await this.auth.signUp(email, password, nickname);
      await this.auth.signIn(email, password);
      this.signUpModal?.classList.add('hidden');
      document.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
    } catch (e) {
      this.showAuthError('Fehler beim Anmelden. Bitte versuche es erneut.');
    } finally {
      this.setLoading(false);
      this.triggerUserChanged();
    }
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
    this.userChangedHandlers.slice(0).forEach(async (handler) => handler(await this.auth.getUser()));
  }

  public onUserChanged(handler: UserChangedHandler) {
    this.userChangedHandlers.push(handler);
  }

  public openSignInModal() {
    this.signInModal = document.querySelector('#sign-in-modal');
    this.signInModal?.classList.remove("hidden");
  }

  public openSignUpModal() {
    this.signUpModal = document.querySelector('#sign-up-modal');
    this.signUpModal?.classList.remove("hidden");
  }

  public closeSignInModal() {
    this.signInModal = document.querySelector('#sign-in-modal');
    this.signInModal?.classList.add("hidden");
  }

  public closeSignUpModal() {
    this.signUpModal = document.querySelector('#sign-up-modal');
    this.signUpModal?.classList.add("hidden");
  }

  private setLoading(state: boolean) {
    this.signInForm?.querySelector('button.primary')!
      .classList.toggle('loading', state);
  }

  private async loadSignInTemplate(): Promise<void> {
    if (document.getElementById('sign-in-modal'))
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

  private async loadSignUpTemplate(): Promise<void> {
    if (document.getElementById('sign-up-modal'))
      return; // already loaded

    const res = await fetch('/src/auth/sign_up_modal.html');
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
