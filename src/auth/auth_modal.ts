import { DummyAuthService } from './auth_service';

let backdrop: HTMLElement | null = null;
let errorBox: HTMLElement | null = null;
let form: HTMLFormElement | null = null;
export async function initAuthModal() {
  await loadAuthTemplate();
  backdrop = document.querySelector('.auth-backdrop');
  errorBox = backdrop?.querySelector('.auth-error') as HTMLElement;
  closeAuthModal();
  const auth = new DummyAuthService();
  form = document.getElementById('auth-form') as HTMLFormElement;

  form.addEventListener('submit', async (e) => {
    if (!form) return;
    e.preventDefault();
    clearAuthError();
    const email = (form[0] as HTMLInputElement).value;
    try {
      setLoading(true);
      await auth.signIn(email);
      backdrop?.classList.add('hidden');
      document.dispatchEvent(new CustomEvent('auth:login'));
    } catch (e) {
      showAuthError('Fehler beim Anmelden. Bitte versuche es erneut.');
    }
    finally {
      setLoading(false);
    }
  });

  backdrop?.querySelector('.cancel')!
    .addEventListener('click', closeAuthModal);

  backdrop?.querySelector('.google')!
    .addEventListener('click', () => {
      console.log('Google login (dummy)');
    });
  backdrop?.querySelector('#forgot-password')!
    .addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Forgot password clicked (UI only)');
    });
}

export function openAuthModal() {
  backdrop?.classList.remove("hidden");
}

export function closeAuthModal() {
  backdrop?.classList.add("hidden");
}

function setLoading(state: boolean) {
  form?.querySelector('button.primary')!
    .classList.toggle('loading', state);
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

function showAuthError(message: string) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearAuthError() {
  errorBox?.classList.add('hidden');
}
