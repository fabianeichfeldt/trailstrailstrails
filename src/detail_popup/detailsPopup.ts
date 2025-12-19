import {formatDate} from "../js/formatDate";

import "/src/detail_popup/details_popup.css";
import "/src/detail_popup/yt.css";

import {isDirtPark, Trail} from "../js/types/Trail";
import {TrailDetails} from "../js/types/TrailDetails";

export function getTrailPopup(trail: Trail) {
    let popupHtml = `
    <div class="popup-content">
    <div class="popup-header">
      <a href="${trail.approved ? trail.url : '#'}" class="${!trail.approved ? 'disabled' : ''}" target="_blank">
        ${trail.name}
        <i class=\"fa-solid fa-arrow-up-right-from-square\"></i>
      </a>
      </div>
  `;

    if (trail.instagram && trail.instagram.trim() !== "") {
        popupHtml += `
      <div class="popup-instagram">
        <a href="https://instagram.com/${trail.approved ? trail.instagram : ''}" target="_blank">
          <i class="fab fa-instagram" style="margin-right: 6px; font-size: 16px;"></i>
          <span>${trail.instagram}</span>
        </a>
      </div>
    `;
    }

    popupHtml += `
    <div class="popup-section loading">
      <p>Lade Details …</p>
    </div>
  `;

    if (trail.creator && trail.creator.trim() !== "")
        popupHtml += `
        <div class="popup-creator">
          <i class="fa-regular fa-user" style="margin-right: 4px;"></i>
          <span>Eingetragen von <strong>${trail.creator}</strong></span>
        </div>
      `;


    popupHtml += "</div>";
    return popupHtml;
}

export async function renderTrailDetails(trail: Trail, details: TrailDetails) {
  const dirtparkInfo = renderDirtparkDetails(trail);

  const rules = (details.rules && details.rules.length > 0) ? details.rules : ["Keine besonderen Regeln bekannt."];
  const hours = details.opening_hours || "Keine zeitlichen Einschränkungen.";

  const rulesHTML = rules.map(r => `<p>${r}</p>`).join('');

  const photosHTML = renderPhotos(details);
  const videoHTML = renderVideos(details);

  return `
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
                <button class="thumb-btn up" title="Ja, hilfreich" onclick="upVoteIntern('${trail.id}', this)">
                  <i class="fa-solid fa-thumbs-up"></i>
                </button>
                <button class="thumb-btn down" title="Nein" onclick="downVoteIntern('${trail.id}', this)">
                  <i class="fa-solid fa-thumbs-down"></i>
                </button>
              </div>
            </div>
            <p class="popup-feedback-date">Zuletzt aktualisiert: ${formatDate(details.last_update)} - generiert mit KI</p>
        `;
}

function renderPhotos(details: TrailDetails) {
  if (details.photos.length === 0) {
    return `<div class="no-photos">
              <p>
                <strong>Oops!</strong><br>
                Hier gibt es noch keine Fotos.<br>
                Du hast ein Foto, das hier erscheinen soll?<br>
                Schreib uns: <a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a>
              </p>
            </div>`;
  }
    const photos = details.photos.map((p, i) => `
            <div class="photo-wrap${i === 0 ? " active" : ""}" style="--img:url('${p.url}')">
              <img alt="offizieller MTB Trail" src="${p.url}" class="${i === 0 ? "active" : ""}">
            </div>
          `).join('');

    const dots = details.photos.map((_, i) => `
            <span class="dot${i === 0 ? " active" : ""}"></span>
          `).join('');

    return `<div class="popup-photos">
              <div class="photo-carousel">
                ${photos}
              </div>
              <div class="carousel-dots">
                ${dots}
              </div>
            </div>`;
}

function renderDirtparkDetails(trail: Trail) {
  if(!isDirtPark(trail))
    return "";

  return `<div class="popup-section">
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
  </div>`;
}

function renderVideos(details: TrailDetails) {
  if (details.videos.length === 0)
    return "";

  return `<br>
  <div class="yt-2click" data-yt-src="${details.videos[0].url}">
    <div class="yt-thumb">
      <div class="yt-overlay">
        <p class="yt-text">
          Dieses Video wird von YouTube bereitgestellt.<br>
          Durch das Laden können personenbezogene Daten an Google übermittelt werden.<br>
          <a href="${details.videos[0].creator}" class="yt-text"><i class="fa-brands fa-youtube"></i>&nbsp;${details.videos[0].creator.split('/').pop()}</a>
        </p>
        <button class="yt-load-btn">▶ Video laden</button>
      </div>
    </div>
  </div>`;
}