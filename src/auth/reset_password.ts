import "/src/auth/auth_modal.css"
import "/src/css/style.css"
import { Supabase } from "../auth/supabase";
import {Auth} from "./auth";
import {showToast} from "../toast";

const signUpForm = document.getElementById('signup-form') as HTMLFormElement;


const cancelButton = document.querySelector('.cancel') as HTMLElement;
cancelButton.addEventListener('click', () => {
  document.location.href = '/';
});

function showError(message: string) {
  const errorBox = document.getElementById('signup-error') as HTMLElement;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

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
