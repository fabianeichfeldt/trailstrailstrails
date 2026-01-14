import {IAuthService} from "./auth_service";
import "@fortawesome/fontawesome-free/css/all.css";

export class ProfileSettingsPage {
  private auth: IAuthService;
  private avatarImg: HTMLImageElement = null!;
  private avatarInput: HTMLInputElement = null!;
  private emailInput: HTMLInputElement = null!;
  private nicknameInput: HTMLInputElement = null!;
  private pwInput: HTMLInputElement = null!;
  private pwRepeatInput: HTMLInputElement = null!;
  private oldPwInput: HTMLInputElement = null!;

  public constructor(auth: IAuthService) {
    this.auth = auth;
  }
  public async initProfilePage() {
    this.cacheElements();
    this.bindEvents();
    await this.loadProfile();
  }

  private cacheElements() {
    this.avatarImg = document.getElementById('profile-avatar-img') as HTMLImageElement;
    this.avatarInput = document.getElementById('avatar-input') as HTMLInputElement;

    const inputs = document.querySelectorAll('.profile-form input');
    this.emailInput = inputs[0] as HTMLInputElement;
    this.nicknameInput = inputs[1] as HTMLInputElement;
    this.oldPwInput = inputs[2] as HTMLInputElement;
    this.pwInput = inputs[3] as HTMLInputElement;
    this.pwRepeatInput = inputs[4] as HTMLInputElement;
  }

  private bindEvents() {
    document
      .querySelector('.avatar-edit')!
      .addEventListener('click', () => this.avatarInput?.click());

    this.avatarInput?.addEventListener('change', this.onAvatarSelected.bind(this));

    document
      .querySelector('.profile-form')!
      .addEventListener('submit', this.onSave.bind(this));

    const toggles = document.querySelectorAll<HTMLButtonElement>('.toggle-password');

    toggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const wrapper = toggle.closest('.password-field');
        if (!wrapper) return;

        const input = wrapper.querySelector<HTMLInputElement>('input');
        const icon = toggle.querySelector('i');
        if (!input || !icon) return;

        const isHidden = input.type === 'password';

        input.type = isHidden ? 'text' : 'password';

        icon.classList.toggle('fa-eye', !isHidden);
        icon.classList.toggle('fa-eye-slash', isHidden);

        toggle.setAttribute(
          'aria-label',
          isHidden ? 'Passwort verbergen' : 'Passwort anzeigen'
        );
      });
    });
  }

  public async loadProfile() {
    const user = await this.auth.getUser();
    if (!user) return;

    this.emailInput.value = user.email;
    this.nicknameInput.value = user.nickname;

    this.avatarImg.src =
      user.avatarUrl ?? '/src/assets/avatar-placeholder.webp';
  }

  private async onAvatarSelected() {
    const file = this.avatarInput.files?.[0];
    if (!file) return;

    // optimistic preview
    this.avatarImg.src = URL.createObjectURL(file);

    const uploadedUrl = await this.auth.uploadAvatar(file);
    await this.auth.updateProfile({ avatarUrl: uploadedUrl });
  }

    private async verifyOldPassword(oldPassword: string): Promise<boolean> {
      const user = await this.auth.getUser();
      if (!user) return false;

      try {
        await this.auth.signIn(user.email, oldPassword);
        return true;
      } catch (e) {
        return false;
      }
    }

  private async onSave(e: Event) {
    e.preventDefault();

    if (!await this.verifyOldPassword(this.oldPwInput.value)) {
      alert('Falsches Passwort');
      return;
    }
    if (this.pwInput?.value || this.pwRepeatInput?.value) {
      if (this.pwInput?.value !== this.pwRepeatInput?.value) {
        alert('Passwörter stimmen nicht überein');
        return;
      }
      await this.auth.updatePassword(this.oldPwInput.value, this.pwInput?.value);
    }

    await this.auth.updateProfile({
      nickname: this.nicknameInput.value
    });

    this.oldPwInput.value = '';
    this.pwInput.value = '';
    this.pwRepeatInput.value = '';

    alert('Profil gespeichert');
  }
}
