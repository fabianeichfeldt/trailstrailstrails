import { getTrailDetails } from "./data/trails.js";
import { formatDate } from "./formatDate.js";

export async function getTrailDetailsHTML(trail, type) {
  const dirtparkInfo = type === 'dirtpark' ? `<div class="popup-section">
    <div class="multi-select">
      <label class="multi-option">
      <input type="checkbox" id="hasPumprack" name="subType" value="pumptrack" ${trail.pumptrack ? 'checked' : ''} disabled>
      <span class="multi-btn">${trail.pumptrack ? '✅' : '❌'} Pumptrack</span>
      </label>
      
      <label class="multi-option">
      <input type="checkbox" name="subType" id="hasDirtpark" value="dirtpark" ${trail.dirtpark ? 'checked' : ''} disabled>
      <span class="multi-btn">${trail.dirtpark ? '✅' : '❌'} Dirtpark</span>
      </label>
    </div>
  </div>` : '';

  const details = await getTrailDetails(trail.id, type);

  const rules = (details.rules && details.rules.length > 0) ? details.rules : ["Keine besonderen Regeln bekannt."];
  const hours = details.opening_hours || "Keine zeitlichen Einschränkungen.";

  const rulesHTML = rules.map(r => `<p>${r}</p>`).join('');

  let photosHTML;
  if (details.photos.length === 0) {
    photosHTML = `
            <div class="no-photos">
              <p>
                <strong>Oops!</strong><br>
                Hier gibt es noch keine Fotos.<br>
                Du hast ein Foto, das hier erscheinen soll?<br>
                Schreib uns: <strong>webmaster@trailradar.org</strong>
              </p>
            </div>
          `;
  } else {
    const photos = details.photos.map((p, i) => `
            <div class="photo-wrap${i === 0 ? " active" : ""}" style="--img:url('${p.url}')">
              <img src="${p.url}" class="${i === 0 ? "active" : ""}">
            </div>
          `).join('');

    const dots = details.photos.map((_, i) => `
            <span class="dot${i === 0 ? " active" : ""}"></span>
          `).join('');

    photosHTML = `
            <div class="popup-photos">
              <div class="photo-carousel">
                ${photos}
              </div>
              <div class="carousel-dots">
                ${dots}
              </div>
            </div>
          `;
  }
  const videoHTML = details.videos.length > 0 ? `<br>
  <div class="yt-2click" data-yt-src="${details.videos[0].url}">
    <div class="yt-thumb">
      <div class="yt-overlay">
        <p class="yt-text">
          Dieses Video wird von YouTube bereitgestellt.<br>
          Durch das Laden können personenbezogene Daten an Google übermittelt werden.
        </p>
        <button class="yt-load-btn">▶ Video laden</button>
      </div>
    </div>
  </div>` : '';

  const detailsHTML = `
        ${photosHTML}
        ${videoHTML}
        ${dirtparkInfo}
          <div class="popup-section">
            <h4>⏰ Öffnungszeiten / Fahrverbote</h4>
            <p>${hours}</p>
          </div>
          <div class="popup-section">
            <h4>📜 Nutzungsregeln</h4>
            ${rulesHTML}
          </div>
            <div class="popup-feedback" data-trail-id="${trail.id}">
              <span class="feedback-label">Sind diese Infos hilfreich?</span>
              <div class="feedback-buttons">
                <button class="thumb-btn up" title="Ja, hilfreich" onclick="upVote('${trail.id}', this)">
                  <i class="fa-solid fa-thumbs-up"></i>
                </button>
                <button class="thumb-btn down" title="Nein" onclick="downVote('${trail.id}', this)">
                  <i class="fa-solid fa-thumbs-down"></i>
                </button>
              </div>
            </div>
            <p class="popup-feedback-date">Zuletzt aktualisiert: ${formatDate(details.last_update)} - generiert mit KI</p>
        `;
  return detailsHTML;
}

export function setupYT2Click() {
  const box = document.querySelector(".yt-2click");
  if (!box) return;
  const url = box.dataset.ytSrc;
  box.querySelector(".yt-load-btn").addEventListener("click", (e) => {
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

export function startPhotoCarousel() {
  const slides = document.querySelectorAll(".photo-wrap");
  const dots = document.querySelectorAll(".carousel-dots .dot");

  let current = 0;

  function showSlide(index) {
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