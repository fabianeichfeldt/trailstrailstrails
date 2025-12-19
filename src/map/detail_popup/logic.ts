import { downVote, upVote } from "../../feedback";
import { showToast } from "../../toast";

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

export function bindPopupEvents(popup: HTMLElement) {
    const feedback = popup.querySelector(".popup-feedback");
    if (!feedback) return;

    const trailId = feedback.getAttribute("data-trail-id");
    if (!trailId) return;

    feedback.addEventListener("click", async (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        if (action === "upvote") {
            await upVote(trailId, btn);
            showToast("Danke für dein Feedback! 🙏", "success");
        }
        if (action === "downvote") {
            await downVote(trailId, btn);
            showToast("Danke für dein Feedback! 🙏", "success");
        }
    });
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
