export function setupYT2Click(popup: HTMLElement) {
  const box: HTMLDivElement | null = popup.querySelector(".yt-2click");
  console.log(box);
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