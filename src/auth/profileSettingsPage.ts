import {IAuthService} from "./auth_service";

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
    this.pwRepeatInput = inputs[2] as HTMLInputElement;
  }

  private bindEvents() {
    document
      .querySelector('.avatar-edit')!
      .addEventListener('click', () => this.avatarInput?.click());

    this.avatarInput?.addEventListener('change', this.onAvatarSelected.bind(this));

    document
      .querySelector('.profile-form')!
      .addEventListener('submit', this.onSave.bind(this));
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

  private async onSave(e: Event) {
    e.preventDefault();

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
