import "/src/auth/auth_modal.css"
import "/src/css/style.css"
import "@fortawesome/fontawesome-free/css/all.css";
import { Supabase } from "./supabase";
const signUpForm = document.getElementById('signup-form') as HTMLFormElement;


const cancelButton = document.querySelector('.cancel') as HTMLElement;
cancelButton.addEventListener('click', () => {
  document.location.href = '/';
});

signUpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const authService = new Supabase();
  if (!authService.loggedIn) {
    showError('Bitte logge dich zuerst ein!');
    throw new Error('Bitte logge dich zuerst ein!');
  }

  const password = (signUpForm[0] as HTMLInputElement).value;
  const passwordConfirm = (signUpForm[1] as HTMLInputElement).value;
  if (password !== passwordConfirm) {
    showError('Passwörter stimmen nicht überein');
    throw new Error('Passwörter stimmen nicht überein');
  }

  await authService.updatePassword('', password);
  document.location.href = '/';
});
initPasswordToggles();

function initPasswordToggles() {
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

function showError(message: string) {
  const errorBox = document.getElementById('signup-error') as HTMLElement;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}