import {IAuthService} from "./auth_service";
import {Supabase} from './supabase';

import "/src/css/style.css";
import "/src/css/photo_caroussel.css";
import "/src/auth/auth_modal.css";
import "/src/auth/profile.css";

import "@fortawesome/fontawesome-free/css/all.css";
import {getPhotosByUserId, getTrailsByUserId} from "../communication/trails";
import {formatDate} from "../formatDate";

export class ProfileSettingsPage {
  private auth: IAuthService;
  private avatarImg: HTMLImageElement = null!;
  private avatarInput: HTMLInputElement = null!;
  private emailInput: HTMLInputElement = null!;
  private nicknameInput: HTMLInputElement = null!;
  private pwInput: HTMLInputElement = null!;
  private pwRepeatInput: HTMLInputElement = null!;
  private oldPwInput: HTMLInputElement = null!;
  private createdTrailsContainer: HTMLElement = null!;
  private createdPhotosContainer: HTMLElement = null!;

  public constructor(auth: IAuthService) {
    this.auth = auth;
  }
  public async initProfilePage() {
    this.cacheElements();
    this.bindEvents();
    await this.loadProfile();
    await this.loadContributions();
    this.initSliders();
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

    this.createdTrailsContainer = document.getElementById('trail-list') as HTMLElement;
    this.createdPhotosContainer = document.getElementById('photo-list') as HTMLElement;
  }

  private bindEvents() {
    document
      .querySelector('.avatar-edit')!
      .addEventListener('click', () => this.avatarInput?.click());

    this.avatarInput?.addEventListener('change', this.onAvatarSelected.bind(this));

    document
      .querySelector('#password-form')!
      .addEventListener('submit', this.onUpdatePassword.bind(this));
    document
      .querySelector('#profile-form')!
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

  public async loadContributions() {
    const user = await this.auth.getUser();
    if (!user) return;

    const trails = await getTrailsByUserId(user.id);
    if (trails.length === 0)
      this.createdTrailsContainer.innerHTML = `<li class="slide empty">Noch keine Trails erstellt</li>`
    else
    this.createdTrailsContainer.innerHTML = trails.map(trail => `<li class="slide">
      <span class="contribution-title">${trail.name}</span>
      <span class="contribution-meta">
        erstellt am ${formatDate(trail.created_at)}
      </span>
    </li>`)
      .join('\n');

    const photos = await getPhotosByUserId(user.id);
    if (photos.length === 0)
      this.createdPhotosContainer.innerHTML = `<div class="no-photos">
        <div class="no-photo-inner">
          <div class="no-photo-icon">📷</div>
          <p>
            <strong>Noch keine Fotos</strong><br>
            Hilf der Community und lade das erste Foto hoch.
          </p>
</div>
      </div>`
    else
      this.createdPhotosContainer.innerHTML = photos.map((p, i) => {
      const date = new Date(p.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
      return `
            <div class="photo-wrap${i === 0 ? " active" : ""}" style="--img:url('${p.url}')">
              <img alt="offizieller MTB Trail" src="${p.url}" class="${i === 0 ? "active" : ""}">
                <div class="photo-meta">
                  <span class="photo-uploader">von ${ this.nicknameInput.value }</span>
                  <span class="photo-date">${date}</span>
                </div>
            </div>
          `
    }).join('\n');
  }
  public async loadProfile() {
    const user = await this.auth.getUser();
    if (!user) return;

    this.emailInput.value = user.email;
    this.nicknameInput.value = user.nickname;

    this.avatarImg.src =
      user.avatarUrl ?? '/src/assets/avatar-placeholder.webp';
  }

  private initSliders() {
    const slides = document.querySelectorAll(".photo-wrap");

    let current = 0;

    function showSlide(index: number) {
      slides[current]?.classList.remove("active");

      current = index;

      slides[current]?.classList.add("active");
    }

    setInterval(() => {
      showSlide((current + 1) % slides.length);
    }, 4000);
  }

  private async onAvatarSelected() {
    const file = this.avatarInput.files?.[0];
    if (!file) return;

    // optimistic preview
    this.avatarImg.src = URL.createObjectURL(file);

    const uploadedUrl = await this.auth.uploadAvatar(file);
    await this.auth.updateProfile({ avatar_url: uploadedUrl });
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

  private async onUpdatePassword(e: Event) {
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

    this.oldPwInput.value = '';
    this.pwInput.value = '';
    this.pwRepeatInput.value = '';

    alert('Passwort gespeichert');
  }

  private async onSave(e: Event) {
    e.preventDefault();

    await this.auth.updateProfile({
      name: this.nicknameInput.value
    });
    alert('Profil gespeichert');
  }
}

const profile = new ProfileSettingsPage(new Supabase());
await profile.initProfilePage();
