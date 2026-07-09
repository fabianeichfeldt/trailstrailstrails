import {formatDate} from "../../utils/formatDate";

import "./details_popup.css";
import "../../css/photo_caroussel.css";
import "./yt.css";

import {isDirtPark, Trail} from "../../types/Trail";
import {TrailDetails} from "../../types/TrailDetails";
import type {IAuthService} from "../../auth/auth_service";
import type {Auth} from "../../auth/auth";

export function getTrailPopup(trail: Trail) {
    let popupHtml = `
    <div class="popup-content">
    <div class="popup-header">
      <a href="${trail.approved ? trail.url : '#'}" class="${!trail.approved ? 'disabled' : ''}" target="_blank">
        ${trail.name}
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

function computeEffectiveStatus(d: TrailDetails): {
  status: 'open' | 'limited' | 'closed' | 'unknown';
  reason?: string;
} {
  const s = d.status ?? 'open';
  if (s !== 'open' && d.status_until) {
    if (new Date() > new Date(d.status_until + 'T23:59:59')) return { status: 'open' };
  }
  if (d.seasonal_from && d.seasonal_to) {
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const from = d.seasonal_from, to = d.seasonal_to;
    const inSeason = from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to;
    if (inSeason) {
      const [fm, fd] = from.split('-'), [tm, td] = to.split('-');
      return { status: 'closed', reason: `Saisonale Sperrung ${fd}.${fm}. – ${td}.${tm}.` };
    }
  }
  return { status: s };
}

const STATUS_META = {
  open:    { label: 'Geöffnet',          cls: 'ssb-open'    },
  limited: { label: 'Eingeschränkt',     cls: 'ssb-limited' },
  closed:  { label: 'Geschlossen',         cls: 'ssb-closed'  },
  unknown: { label: 'Status unbekannt',  cls: 'ssb-unknown' },
};
const ACCESS_META = {
  paid:       { label: 'Kostenpflichtig', cls: 'ssb-access-paid'       },
  membership: { label: 'Mitgliedschaft',  cls: 'ssb-access-membership' },
};

function renderSpotStatusBanner(details: TrailDetails): string {
  const { status, reason } = computeEffectiveStatus(details);
  const sm = STATUS_META[status] ?? STATUS_META.unknown;

  let hint = reason || details.status_hint || '';
  if (!hint && details.status_until && status !== 'open') {
    const d = new Date(details.status_until);
    hint = `Gesperrt bis ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  }

  const accessType = details.access_type;
  const accessBadge = accessType === 'paid'
    ? `<span class="ssb-access ssb-access-paid"><i class="fas fa-coins"></i> ${ACCESS_META.paid.label}</span>`
    : accessType === 'membership'
      ? `<span class="ssb-access ssb-access-membership"><i class="fas fa-id-card"></i> ${ACCESS_META.membership.label}</span>`
      : details.donation_url
        ? `<a class="ssb-donate-cta" href="${details.donation_url}" target="_blank" rel="noopener noreferrer"><i class="fas fa-heart"></i> Kostenlos · Spenden willkommen</a>`
        : '';

  const rainHint = details.rain_policy === 'during'
    ? `<span class="ssb-rain"><i class="fas fa-cloud-rain"></i> Geschlossen bei Regen</span>`
    : details.rain_policy === 'after'
      ? `<span class="ssb-rain"><i class="fas fa-cloud-rain"></i> Geschlossen ${details.rain_closed_hours ?? 24}h nach Regen</span>`
      : '';

  return `
    <div class="spot-status-banner ${sm.cls}">
      <div class="ssb-info">
        <span class="ssb-dot"></span>
        <div class="ssb-labels">
          <strong>${sm.label}</strong>
          ${hint ? `<span class="ssb-hint">${hint}</span>` : ''}
        </div>
      </div>
      ${accessBadge ? `<div class="ssb-row">${accessBadge}</div>` : ''}
      ${rainHint ? `<div class="ssb-row">${rainHint}</div>` : ''}
    </div>`;
}

export function renderTrailDetails(trail: Trail, details: TrailDetails, auth: Auth) {
  const statusBanner = details.status ? renderSpotStatusBanner(details) : '';
  const dirtparkInfo = renderDirtparkDetails(trail);

  const rules = (details.rules && details.rules.length > 0) ? details.rules : ["Keine besonderen Regeln bekannt."];
  const hours = details.opening_hours || "Keine zeitlichen Einschränkungen.";

  const rulesHTML = rules.map(r => `<p>${r}</p>`).join('');
  const detailsHTML = "<p>" + details.trail_description + "</p>";

  const photosHTML = renderPhotos(details, auth.authService);
  const videoHTML = renderVideos(details);
  const spotcheckHTML = trail.spotcheck && trail.spotcheck.trim() !== ""
    ? `<div class="popup-section">
        <a href="${trail.spotcheck}" target="_blank" class="spotcheck-badge">
          <i class="fa-solid fa-circle-check"></i> Trailradar Spotcheck
        </a>
      </div>`
    : "";

  return `
        ${statusBanner}
        ${photosHTML}
        ${videoHTML}
        ${spotcheckHTML}
        ${dirtparkInfo}
        ${details.opening_hours ? `
          <div class="popup-section">
            <h4>⏰ Öffnungszeiten / Fahrverbote</h4>
            <p>${hours}</p>
          </div>` : ''}
          ${details.rules && details.rules.length > 0 ? `
          <div class="popup-section">
            <h4>📜 Nutzungsregeln</h4>
            ${rulesHTML}
          </div>` : ``}
          ${details.trail_description && details.trail_description.length > 0 ? `
          <div class="popup-section">
            <h4>📜 Allgemeine Infos</h4>
            ${detailsHTML}
          </div>` : ``}
            <div class="popup-feedback" data-trail-id="${trail.id}" data-trail-name="${trail.name}">
              <span class="feedback-label">Sind diese Infos hilfreich?</span>
              <div class="feedback-actions">
                <div class="feedback-buttons">
                  <button class="thumb-btn up" title="Ja, hilfreich" communication-action="upvote">
                    <i class="fa-solid fa-thumbs-up"></i>
                  </button>
                  <button class="thumb-btn down" title="Nein" communication-action="downvote">
                    <i class="fa-solid fa-thumbs-down"></i>
                  </button>
                </div>
                <button class="report-error-link" communication-action="report" title="Fehler melden">
                  <i class="fa-solid fa-flag"></i> Fehler melden
                </button>
              </div>
            </div>
            <p class="popup-feedback-date">Zuletzt aktualisiert: ${formatDate(details.last_update)} - generiert mit KI</p>
        `;
}

function renderPhotos(details: TrailDetails, auth: IAuthService) {
  if (details.photos.length === 0) {
    return `
      <div class="no-photos">
        <div class="no-photo-inner">
          <div class="no-photo-icon">📷</div>
          <p>
            <strong>Noch keine Fotos</strong><br>
            Hilf der Community und lade das erste Foto hoch.
          </p>

          ${
      auth.loggedIn
        ? `
                <button class="photo-upload-btn" data-action="upload-photo">
                  ➕ Foto hochladen
                </button>
              `
        : `
                <span class="photo-login-link">
                  Einloggen zum Hochladen
                </span>
              `
    }
        </div>
      </div>
    `;
  }
    const photos = details.photos.map((p, i) => {
      const date = new Date(p.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
      return `
            <div class="photo-wrap${i === 0 ? " active" : ""}" style="--img:url('${p.url}')">
              <img alt="offizieller MTB Trail" src="${p.url}" class="${i === 0 ? "active" : ""}">
                <div class="photo-meta">
                  <span class="photo-uploader">von ${p.profiles?.display_name || ""}</span>
                  <span class="photo-date">${date}</span>
                </div>
            </div>
          `
    }).join('');

    const dots = details.photos.map((_, i) => `
            <span class="dot${i === 0 ? " active" : ""}"></span>
          `).join('');

    return `<div class="photo-container">
              <div class="photo-carousel">
                ${photos}
              </div>
              ${auth.loggedIn
                ? `
                    <button class="photo-fab" title="Foto hinzufügen" data-action="upload-photo">
                      ➕
                    </button>
                  `
                : ""
            }
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