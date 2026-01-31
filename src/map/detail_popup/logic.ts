import {downVote, upVote} from "../../feedback";
import {showToast} from "../../toast";
import {IAuthService} from "../../auth/auth_service";
import {Auth} from "../../auth/auth";

const MAX_FILE_SIZE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function startPhotoCarousel(popup: HTMLElement) {
  const slides = popup.querySelectorAll(".photo-wrap");
  const dots = popup.querySelectorAll(".carousel-dots .dot");

  let current = 0;

  function showSlide(index: number) {
    slides[current]?.classList.remove("active");
    dots[current]?.classList.remove("active");

    current = index;

    slides[current]?.classList.add("active");
    dots[current]?.classList.add("active");
  }

  setInterval(() => {
    showSlide((current + 1) % slides.length);
  }, 4000);
}

export function bindPopupEvents(popup: HTMLElement, auth: Auth, onPhotoUploaded: () => void) {
  const feedback: HTMLDivElement | null = popup.querySelector(".popup-feedback");
  if (!feedback) return;
  const trailId = feedback.dataset.trailId;
  if (!trailId) return;

  feedback.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;

    const action = btn.getAttribute("communication-action");
    if (action === "upvote") {
      await upVote(trailId, btn);
      showToast("Danke für dein Feedback! 🙏", "success");
    }
    if (action === "downvote") {
      await downVote(trailId, btn);
      showToast("Danke für dein Feedback! 🙏", "success");
    }
  });
  const uploadBtn = popup.querySelector(".photo-upload-btn");
  if (uploadBtn)
    uploadBtn.addEventListener("click", () => {
       startUpload(auth.authService, trailId, onPhotoUploaded);
    });
  const loginBtn = popup.querySelector(".photo-login-link");
  if (loginBtn)
    loginBtn.addEventListener("click", async () => {
      await auth.openSignInModal();
    })
}

export function setupYT2Click(popup: HTMLElement) {
  const box: HTMLDivElement | null = popup.querySelector(".yt-2click");
  if (!box) return;
  const url = box.dataset.ytSrc || "";
  box.querySelector(".yt-load-btn")?.addEventListener("click", (e) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.loading = "lazy";
    iframe.style.aspectRatio = "16 / 9";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.style.width = "100%";
    iframe.style.border = "none";

    box.innerHTML = "";
    box.appendChild(iframe);
    e.stopPropagation();   // ⛔ prevent Leaflet from closing popup
    e.preventDefault();
  });
}

function startUpload(auth: IAuthService, trailId: string, onPhotoUploaded: () => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Bitte lade nur JPG, PNG oder WebP hoch.");
      return;
    }

    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_FILE_SIZE_MB) {
      alert(`Datei ist zu groß (max ${MAX_FILE_SIZE_MB} MB).`);
      return;
    }

    try {
      showToast("📤 Upload läuft...");

      await auth.uploadTrailPhoto(file, trailId);
      showToast("✅ Upload erfolgreich!");
      onPhotoUploaded();
    } catch (err) {
      console.error(err);
      alert("Upload fehlgeschlagen 😢");
    }
  };

  document.body.appendChild(input);
  input.click();
  input.remove();
}
