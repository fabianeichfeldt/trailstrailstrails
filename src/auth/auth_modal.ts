import { DummyAuthService } from './auth_service';

let backdrop: HTMLElement | null = null;
export async function initAuthModal() {
  await loadAuthTemplate();
  backdrop = document.querySelector('.auth-backdrop');
  closeAuthModal();
  const auth = new DummyAuthService();
  const form = document.getElementById('auth-form') as HTMLFormElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (form[0] as HTMLInputElement).value;
    await auth.signIn(email);
    backdrop?.setAttribute('hidden', '');
    document.dispatchEvent(new CustomEvent('auth:login'));
  });

  backdrop?.querySelector('.cancel')!
    .addEventListener('click', closeAuthModal);

  backdrop?.querySelector('.google')!
    .addEventListener('click', () => {
      console.log('Google login (dummy)');
    });
}

export function openAuthModal() {
  backdrop?.classList.remove("hidden");
}

export function closeAuthModal() {
  backdrop?.classList.add("hidden");
}

async function loadAuthTemplate(): Promise<void> {
  if (document.getElementById('auth-modal'))
    return; // already loaded

  const res = await fetch('/src/auth/auth_modal.html');
  const html = await res.text();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const template = wrapper.querySelector('div');
  if (!template) {
    throw new Error('Auth template not found');
  }

  document.body.appendChild(template);
}
