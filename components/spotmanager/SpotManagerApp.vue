<template>
  <div class="sm-shell">
    <!-- Top bar -->
    <div class="sm-topbar">
      <NuxtLink to="/" class="sm-topbar-home" title="Zurück zur Karte">
        <img src="/assets/logo.webp" class="sm-topbar-logo-img" alt="Trailradar" />
      </NuxtLink>
      <div class="sm-topbar-divider" />
      <button v-if="view !== 'selector'" class="sm-back-btn" @click="goBack">
        <i class="fas fa-arrow-left" />
      </button>
      <button v-if="view === 'list'" class="sm-help-btn" title="Hilfe" @click="helpOpen = true">
        <i class="fas fa-question-circle" />
      </button>
      <span class="sm-topbar-title">{{ view === 'selector' ? 'Spot Manager' : view === 'embed-list' ? 'Embed-Tokens' : view === 'embed-edit' ? (embedEditTarget ? 'Token bearbeiten' : 'Token erstellen') : spotName }}</span>
      <span class="sm-role-badge">{{ role }}</span>
      <UserAvatar />
    </div>

    <div class="sm-body">
      <!-- Sidebar -->
      <aside class="sm-sidebar">
        <!-- Loading -->
        <template v-if="loading">
          <div class="sm-spinner" />
          <p class="sm-center-msg">Lade…</p>
        </template>

        <!-- Access error -->
        <p v-else-if="accessError" class="sm-center-msg sm-error">{{ accessError }}</p>

        <!-- Spot selector -->
        <div v-else-if="view === 'selector'" class="sm-spot-list">
          <p v-if="spots.length === 0" class="sm-center-msg">
            Keine Spots gefunden.<br>
            <small style="opacity:.7">Rolle: {{ role }}</small>
          </p>
          <button v-for="s in spots" :key="s.id" class="sm-spot-btn" @click="openSpot(s.id, s.name)">
            <span class="sm-spot-name">{{ s.name }}</span>
            <span class="sm-spot-id">{{ s.id.slice(0, 8) }}…</span>
          </button>
          <div v-if="authStore.isAdmin" class="sm-admin-section">
            <div class="sm-admin-divider">Admin</div>
            <button class="sm-spot-btn sm-embed-btn" @click="openEmbedList">
              <span class="sm-spot-name"><i class="fas fa-code" /> Embed-Tokens verwalten</span>
            </button>
          </div>
        </div>

        <!-- Embed token list (admin only) -->
        <EmbedTokenList
          v-else-if="view === 'embed-list'"
          :tokens="embedTokens"
          :trail-counts="embedTokenCounts"
          :loading="embedLoading"
          :error="embedError"
          @create="openEmbedEditor(null)"
          @edit="openEmbedEditor"
          @delete="confirmEmbedDelete"
        />

        <!-- Embed token editor (admin only) -->
        <EmbedTokenEditor
          v-else-if="view === 'embed-edit'"
          :token="embedEditTarget"
          :jwt="embedJwt"
          @cancel="openEmbedList"
          @saved="openEmbedList"
        />

        <!-- Spot list -->
        <div v-else-if="view === 'list'" class="sm-list-view">
          <button class="sm-details-banner" @click="openDetailsEditor">
            <div class="sm-details-banner-left">
              <span class="sm-details-status-dot" :class="`status-${currentStatusMeta.cls}`">
                <i class="fas" :class="currentStatusMeta.icon" />
              </span>
              <div>
                <span class="sm-details-banner-title">Spot-Details</span>
                <span class="sm-details-banner-sub">{{ detailsBannerSub }}</span>
              </div>
            </div>
            <i class="fas fa-chevron-right sm-details-arrow" />
          </button>

          <div class="sm-section">
            <div class="sm-section-header">
              <h3>Trails <span class="sm-count">{{ trails.length }}</span></h3>
              <button class="sm-btn-add" @click="openImport('trail')">
                <i class="fas fa-plus" /> Trail
              </button>
            </div>
            <p v-if="trails.length === 0" class="sm-section-hint">
              Lade zuerst alle Trails hoch. Bei mehreren Schwierigkeiten einen Trail in Abschnitte aufteilen.
            </p>
            <div class="sm-items">
              <p v-if="trails.length === 0" class="sm-empty">Keine Trails</p>
              <div
                v-for="t in trails"
                :key="t.id"
                class="sm-item"
                @mouseenter="mapView?.highlight(t.id)"
                @mouseleave="mapView?.resetHighlights()"
              >
                <div class="sm-item-dot" :style="`background:${DIFF_COLOR[t.difficulty as ImbaColor] ?? '#888'}`" />
                <div class="sm-item-info">
                  <strong>{{ t.name }}</strong>
                  <span class="sm-item-sub">{{ t.distance_km }} km · ↑{{ t.elevation_gain }}m ↓{{ t.elevation_loss }}m</span>
                </div>
                <div class="sm-item-actions">
                  <button class="sm-btn-icon" title="Bearbeiten" @click.stop="openEditTrail(t.id)">
                    <i class="fas fa-pen" />
                  </button>
                  <button class="sm-btn-icon sm-btn-danger" title="Löschen" @click.stop="confirmDelete(t.id, 'trail')">
                    <i class="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="sm-section">
            <div class="sm-section-header">
              <h3>Touren <span class="sm-count">{{ tours.length }}</span></h3>
              <button class="sm-btn-add" @click="openImport('tour')">
                <i class="fas fa-plus" /> Tour
              </button>
            </div>
            <p v-if="tours.length === 0 && trails.length > 0" class="sm-section-hint">
              Trails sind bereit – jetzt Touren hochladen und die enthaltenen Trails zuordnen.
            </p>
            <p v-else-if="tours.length === 0" class="sm-section-hint">
              Touren erst hochladen, nachdem alle Trails angelegt sind.
            </p>
            <div class="sm-items">
              <p v-if="tours.length === 0" class="sm-empty">Keine Touren</p>
              <div
                v-for="t in tours"
                :key="t.id"
                class="sm-item"
                @mouseenter="mapView?.highlight(t.id)"
                @mouseleave="mapView?.resetHighlights()"
              >
                <div class="sm-item-dot sm-item-dot-tour" />
                <div class="sm-item-info">
                  <strong>{{ t.name }}</strong>
                  <span class="sm-item-sub">{{ t.distance_km }} km · {{ t.duration_minutes }} min</span>
                </div>
                <div class="sm-item-actions">
                  <button class="sm-btn-icon" title="Bearbeiten" @click.stop="openEditTour(t.id)">
                    <i class="fas fa-pen" />
                  </button>
                  <button class="sm-btn-icon sm-btn-danger" title="Löschen" @click.stop="confirmDelete(t.id, 'tour')">
                    <i class="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Import view -->
        <div v-else-if="view === 'import'" class="sm-import-view">
          <div class="sm-form-header">
            <button class="sm-btn-back" @click="cancelImport"><i class="fas fa-arrow-left" /></button>
            <h3>GPX importieren</h3>
          </div>

          <div
            class="sm-dropzone"
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="onDrop"
          >
            <i class="fas fa-cloud-upload-alt sm-drop-icon" />
            <p>GPX-Dateien hier ablegen</p>
            <label class="sm-btn-secondary sm-drop-browse">
              <i class="fas fa-folder-open" /> Durchsuchen
              <input type="file" accept=".gpx" multiple hidden @change="onFileInput" />
            </label>
          </div>

          <div class="sm-pending-cards-list">
            <div v-for="(p, i) in pending" :key="p.key" class="sm-pending-card">
              <div class="sm-card-header">
                <span class="sm-card-filename">{{ p.filename }}</span>
                <span class="sm-card-stats">{{ p.processed.rawCount }} → {{ p.processed.thinnedCount }} Punkte</span>
              </div>

              <div class="pk-kind-toggle">
                <button class="pk-kind-btn" :class="{ active: p.kind === 'trail' }" @click="setKind(i, 'trail')">Trail</button>
                <button class="pk-kind-btn" :class="{ active: p.kind === 'tour' }" @click="setKind(i, 'tour')">Tour</button>
              </div>

              <label>Name<input type="text" v-model="p.name" /></label>

              <template v-if="p.kind === 'trail'">
                <label>Schwierigkeit
                  <select v-model="p.difficulty" @change="updatePendingColor(i)">
                    <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
                  </select>
                </label>
                <label>Richtung
                  <select v-model="p.direction">
                    <option v-for="d in DIRECTIONS.filter(d => d.value !== 'cw' && d.value !== 'ccw')" :key="d.value" :value="d.value">{{ d.label }}</option>
                  </select>
                </label>
              </template>
              <template v-else>
                <div v-if="trails.length > 0" class="sm-trail-checks">
                  <span class="sm-label">Enthaltene Trails</span>
                  <label v-for="t in trails" :key="t.name" class="sm-check-label">
                    <input type="checkbox" :value="t.name" v-model="p.trailNames" />
                    {{ t.name }}
                    <span v-if="p.autoDetectedTrailNames.includes(t.name)" class="sm-badge-auto">auto</span>
                  </label>
                </div>
              </template>

              <div class="sm-card-stats-row">
                <span>📍 {{ p.processed.distance_km }} km</span>
                <span>↑{{ p.processed.elevation_gain }} m</span>
                <span>↓{{ p.processed.elevation_loss }} m</span>
                <span v-if="p.processed.duration_minutes">⏱ {{ p.processed.duration_minutes }} min</span>
              </div>

              <div class="sm-card-footer">
                <button class="sm-btn-icon sm-btn-danger" @click="removePending(i)"><i class="fas fa-trash" /></button>
              </div>
            </div>
          </div>

          <div v-if="pending.length > 0" class="sm-import-footer">
            <button class="sm-btn-secondary" @click="cancelImport">Abbrechen</button>
            <button class="sm-btn-primary" :disabled="busy" @click="applyImports">
              <i class="fas fa-check" /> Übernehmen ({{ pending.length }})
            </button>
          </div>
        </div>

        <!-- Edit Trail -->
        <div v-else-if="view === 'edit-trail'" class="sm-edit-form">
          <div class="sm-form-header">
            <button class="sm-btn-back" @click="cancelEdit"><i class="fas fa-arrow-left" /></button>
            <h3>Trail bearbeiten</h3>
          </div>
          <label>Name<input type="text" v-model="efName" /></label>
          <label>Schwierigkeit
            <select v-model="efDiff">
              <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </label>
          <label>Richtung
            <select v-model="efDir">
              <option v-for="d in DIRECTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </label>
          <label>Beschreibung
            <textarea
              v-model="efTrailDesc"
              rows="3"
              placeholder="Kurze Beschreibung des Trails – z. B. Schneller Flowtrail mit zwei Sprüngen und einem steinigen Auslauf. Max. 1–2 Sätze."
            />
          </label>
          <label class="sm-file-label">GPX ersetzen (optional)
            <input type="file" accept=".gpx" @change="onEditGpx" />
          </label>
          <div v-if="editGpxInfo" class="sm-gpx-info">{{ editGpxInfo }}</div>
          <div class="sm-form-actions">
            <button class="sm-btn-secondary" @click="cancelEdit">Abbrechen</button>
            <button class="sm-btn-primary" :disabled="busy" @click="saveTrailEdit">
              <i class="fas fa-save" /> Speichern
            </button>
          </div>
        </div>

        <!-- Edit Tour -->
        <div v-else-if="view === 'edit-tour'" class="sm-edit-form">
          <div class="sm-form-header">
            <button class="sm-btn-back" @click="cancelEdit"><i class="fas fa-arrow-left" /></button>
            <h3>Tour bearbeiten</h3>
          </div>
          <label>Name<input type="text" v-model="efName" /></label>
          <label>Richtung
            <select v-model="efDir">
              <option value="cw">↻ Uhrzeigersinn</option>
              <option value="ccw">↺ Gegen Uhrzeiger</option>
            </select>
          </label>
          <label>Dauer (min)<input type="number" min="1" v-model.number="efDuration" /></label>
          <div v-if="trails.length > 0" class="sm-trail-checks">
            <span class="sm-label">Enthaltene Trails</span>
            <label v-for="t in trails" :key="t.name" class="sm-check-label">
              <input type="checkbox" :value="t.name" v-model="efTrailNames" />
              {{ t.name }}
            </label>
          </div>
          <label class="sm-file-label">GPX ersetzen (optional)
            <input type="file" accept=".gpx" @change="onEditGpx" />
          </label>
          <div v-if="editGpxInfo" class="sm-gpx-info">{{ editGpxInfo }}</div>
          <div class="sm-form-actions">
            <button class="sm-btn-secondary" @click="cancelEdit">Abbrechen</button>
            <button class="sm-btn-primary" :disabled="busy" @click="saveTourEdit">
              <i class="fas fa-save" /> Speichern
            </button>
          </div>
        </div>

        <!-- Spot Details Editor -->
        <div v-else-if="view === 'details'" class="sd-editor">
          <div class="sm-form-header">
            <button class="sm-btn-back" @click="view = 'list'"><i class="fas fa-arrow-left" /></button>
            <h3>Spot-Details</h3>
          </div>

          <!-- Status -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-circle-half-stroke" /> Status</div>
            <div class="sd-status-grid sd-status-grid-3">
              <button
                v-for="s in STATUS_OPTIONS"
                :key="s.value"
                class="sd-status-card"
                :class="{ active: sdStatus === s.value }"
                :style="`--status-color:${s.color}`"
                @click="sdStatus = s.value"
              >
                <i class="fas sd-status-icon" :class="s.icon" />
                <span>{{ s.label }}</span>
              </button>
            </div>
            <div v-show="sdStatus !== 'open'" class="sd-status-sub">
              <div v-show="sdStatus === 'limited' && trails.length > 0">
                <div class="sd-sub-label"><i class="fas fa-route" /> Betroffene Trails</div>
                <div class="sd-trail-check-list">
                  <label v-for="t in trails" :key="t.id" class="sd-check-label">
                    <input type="checkbox" :value="t.id" v-model="sdAffectedIds" />
                    <span class="sd-trail-check-dot" :style="`background:${DIFF_COLOR[t.difficulty as ImbaColor] ?? '#888'}`" />
                    {{ t.name }}
                  </label>
                </div>
                <div class="sd-sub-divider" />
              </div>
              <label class="sd-radio-label">
                <input type="radio" v-model="sdUseUntil" :value="false" /><span>Unbegrenzt</span>
              </label>
              <label class="sd-radio-label">
                <input type="radio" v-model="sdUseUntil" :value="true" /><span>Automatisch öffnen am</span>
              </label>
              <input v-show="sdUseUntil" type="date" v-model="sdStatusUntil" class="sd-input sd-status-until-input" />
            </div>
          </div>

          <!-- Status hint -->
          <div v-show="sdStatus !== 'open'" class="sd-section">
            <div class="sd-section-label"><i class="fas fa-comment-dots" /> Status-Hinweis</div>
            <input type="text" v-model="sdHint" class="sd-input" maxlength="120"
              placeholder="z.B. Gesperrt bis Ende März wegen Forstarbeiten" />
            <div class="sd-char-hint">{{ sdHint.length }}/120</div>
          </div>

          <!-- Access & costs -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-ticket" /> Zugang & Kosten</div>
            <div class="sd-access-grid sd-access-grid-3">
              <button
                v-for="a in ACCESS_OPTIONS"
                :key="a.value"
                class="sd-access-card"
                :class="{ active: sdAccessType === a.value }"
                :style="`--access-color:${a.color}`"
                :title="a.desc"
                @click="sdAccessType = a.value"
              >
                <i class="fas sd-access-icon" :class="a.icon" />
                <span class="sd-access-label">{{ a.label }}</span>
                <span class="sd-access-desc">{{ a.desc }}</span>
              </button>
            </div>
            <div v-show="sdAccessType === 'free'" style="margin-top:6px">
              <label class="sd-date-label">Spendenlink (optional)
                <input type="url" v-model="sdDonationUrl" class="sd-input" placeholder="https://…" />
              </label>
            </div>
          </div>

          <!-- Seasonal closure -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-leaf" /> Jährliche Saisonsperre</div>
            <label class="sd-toggle-row">
              <input type="checkbox" v-model="sdHasSeasonal" />
              <span>Jedes Jahr in diesem Zeitraum gesperrt</span>
            </label>
            <div v-show="sdHasSeasonal" class="sd-sub-block">
              <p class="sd-field-hint">Format TT.MM — wiederholt sich automatisch jedes Jahr</p>
              <div class="sd-date-row">
                <label class="sd-date-label">Von
                  <input type="text" v-model="sdSeasonalFrom" class="sd-input" maxlength="5" placeholder="01.11" />
                </label>
                <label class="sd-date-label">Bis
                  <input type="text" v-model="sdSeasonalTo" class="sd-input" maxlength="5" placeholder="31.03" />
                </label>
              </div>
            </div>
          </div>

          <!-- Rain policy -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-cloud-rain" /> Regensperre</div>
            <div class="sd-radio-group">
              <label class="sd-radio-label">
                <input type="radio" v-model="sdRainPolicy" value="none" /><span>Keine Einschränkung</span>
              </label>
              <label class="sd-radio-label">
                <input type="radio" v-model="sdRainPolicy" value="during" /><span>Gesperrt bei Regen</span>
              </label>
              <label class="sd-radio-label sd-radio-inline">
                <input type="radio" v-model="sdRainPolicy" value="after" />
                <span>Gesperrt</span>
                <input type="number" v-model.number="sdRainHours" class="sd-inline-num" min="1" max="96"
                  :disabled="sdRainPolicy !== 'after'" />
                <span>Stunden nach Regen</span>
              </label>
            </div>
            <div v-show="sdRainPolicy === 'after'" class="sd-sub-block">
              <label class="sd-toggle-row">
                <input type="checkbox" v-model="sdHasWindow" />
                <span>Nur in bestimmtem Jahreszeitraum (z.B. Frühjahrsschmelze)</span>
              </label>
              <div v-show="sdHasWindow" class="sd-window-dates">
                <p class="sd-field-hint">Format TT.MM — z.B. 01.03 bis 15.04</p>
                <div class="sd-date-row">
                  <label class="sd-date-label">Von
                    <input type="text" v-model="sdRainFrom" class="sd-input" maxlength="5" placeholder="01.03" />
                  </label>
                  <label class="sd-date-label">Bis
                    <input type="text" v-model="sdRainTo" class="sd-input" maxlength="5" placeholder="15.04" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Night policy -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-moon" /> Nachtsperrung</div>
            <div class="sd-radio-group">
              <label class="sd-radio-label">
                <input type="radio" v-model="sdNightPolicy" value="none" /><span>Keine</span>
              </label>
              <label class="sd-radio-label">
                <input type="radio" v-model="sdNightPolicy" value="dusk_to_dawn" /><span>Gesperrt Sonnenuntergang bis Sonnenaufgang</span>
              </label>
              <label class="sd-radio-label">
                <input type="radio" v-model="sdNightPolicy" value="offset" /><span>Mit Versatz</span>
              </label>
            </div>
            <div v-show="sdNightPolicy === 'offset'" class="sd-sub-block sd-offset-grid">
              <label class="sd-date-label">Minuten vor Sonnenuntergang
                <input type="number" v-model.number="sdBeforeDusk" class="sd-input" min="0" max="180" />
              </label>
              <label class="sd-date-label">Minuten nach Sonnenaufgang
                <input type="number" v-model.number="sdAfterDawn" class="sd-input" min="0" max="180" />
              </label>
            </div>
          </div>

          <!-- Rules -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-list-check" /> Nutzungsregeln</div>
            <div class="sd-rules-list">
              <div v-for="(_, i) in sdRules" :key="i" class="sd-rule-item">
                <i class="fas fa-grip-vertical sd-rule-grip" />
                <textarea v-model="sdRules[i]" class="sd-rule-input" rows="1" placeholder="Regel eingeben…" />
                <button class="sd-rule-del" @click="sdRules.splice(i, 1)"><i class="fas fa-times" /></button>
              </div>
            </div>
            <button class="sd-add-rule-btn" @click="sdRules.push('')">
              <i class="fas fa-plus" /> Regel hinzufügen
            </button>
          </div>

          <!-- Description -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-align-left" /> Beschreibung</div>
            <textarea v-model="sdDescription" class="sd-textarea" maxlength="2000" placeholder="Allgemeine Infos zum Spot…" />
            <div class="sd-char-hint">{{ sdDescription.length }}/2000</div>
          </div>

          <!-- Invitation codes -->
          <div class="sd-section">
            <div class="sd-section-label"><i class="fas fa-key" /> Einladungscodes (Trailcrew)</div>
            <div v-if="invNewCode" class="inv-new-code">
              <span class="inv-code-chip">{{ invNewCode }}</span>
              <span class="inv-code-meta">Gültig 7 Tage · einmalig verwendbar</span>
            </div>
            <div v-if="invCodes.length" class="inv-list">
              <div v-for="c in invCodes" :key="c.code" class="inv-row" :class="{ 'inv-row--used': c.used_by }">
                <span class="inv-code">{{ c.code }}</span>
                <span class="inv-expires">bis {{ formatInvDate(c.expires_at) }}</span>
                <span class="inv-badge">{{ c.used_by ? 'verwendet' : 'offen' }}</span>
              </div>
            </div>
            <button class="sd-add-rule-btn" :disabled="invGenerating" @click="generateInvCode">
              <i class="fas fa-plus" /> Code erstellen
            </button>
          </div>

          <div class="sd-save-row">
            <button class="sm-btn-secondary" @click="view = 'list'">Abbrechen</button>
            <button class="sm-btn-primary" :disabled="busy" @click="saveDetails">
              <i class="fas fa-save" /> Speichern
            </button>
          </div>
        </div>
      </aside>

      <!-- Map pane (hidden in embed views) -->
      <div v-if="view !== 'embed-list' && view !== 'embed-edit'" class="sm-map-pane">
        <div ref="mapEl" id="sm-map" />
      </div>
    </div>
  </div>

  <!-- Help modal -->
  <Teleport to="body">
    <div v-if="helpOpen" class="sm-modal-overlay" @click.self="helpOpen = false">
      <div class="sm-modal">
        <div class="sm-modal-header">
          <h2><i class="fas fa-question-circle" /> Anleitung – Spot Manager</h2>
          <button class="sm-modal-close" @click="helpOpen = false"><i class="fas fa-times" /></button>
        </div>
        <div class="sm-modal-body">
          <div class="sm-help-step">
            <div class="sm-help-step-num">1</div>
            <div class="sm-help-step-content">
              <h3>Trails hochladen</h3>
              <p>Lade zuerst alle Trails des Spots als GPX-Dateien hoch. Klicke auf <strong>+ Trail</strong> und ziehe die Dateien in die Upload-Zone. Trails und Touren können dabei auch gemischt in einem Schritt importiert werden.</p>
              <div class="sm-help-tip">
                <i class="fas fa-lightbulb" />
                <span>Hat ein Trail unterschiedliche Schwierigkeitsgrade? Teile die GPX-Datei in mehrere Abschnitte auf — jeder bekommt seine eigene Schwierigkeit (grün / blau / rot / schwarz).</span>
              </div>
            </div>
          </div>
          <div class="sm-help-step">
            <div class="sm-help-step-num">2</div>
            <div class="sm-help-step-content">
              <h3>Touren hochladen</h3>
              <p>Sind alle Trails angelegt, können die Touren importiert werden. Klicke auf <strong>+ Tour</strong>. Eine Tour beschreibt eine vollständige Runde und kann mehrere Trails umfassen.</p>
            </div>
          </div>
          <div class="sm-help-step">
            <div class="sm-help-step-num">3</div>
            <div class="sm-help-step-content">
              <h3>Trails einer Tour zuordnen</h3>
              <p>Beim Importieren einer Tour kannst du festlegen, welche Trails sie enthält. Automatisch erkannte Trails sind mit <span class="sm-badge-auto">auto</span> markiert — die Zuordnung sollte immer überprüft werden.</p>
            </div>
          </div>
          <div class="sm-help-step">
            <div class="sm-help-step-num">✎</div>
            <div class="sm-help-step-content">
              <h3>Umbenennen</h3>
              <p>Trails und Touren können jederzeit über den <i class="fas fa-pen" />-Button bearbeitet und umbenannt werden. Beim Bearbeiten lässt sich auch die GPX-Datei ersetzen.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation (trails/tours) -->
    <div v-if="deleteTarget" class="sm-modal-overlay" @click.self="deleteTarget = null">
      <div class="sm-modal sm-confirm-modal">
        <div class="sm-modal-header">
          <h2><i class="fas fa-trash" /> Löschen bestätigen</h2>
          <button class="sm-modal-close" @click="deleteTarget = null"><i class="fas fa-times" /></button>
        </div>
        <div class="sm-modal-body">
          <p style="margin:0">„{{ deleteTarget.name }}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <div class="sm-confirm-actions">
          <button class="sm-btn-secondary" @click="deleteTarget = null">Abbrechen</button>
          <button class="sm-btn-primary sm-btn-delete-confirm" :disabled="busy" @click="executeDelete">
            <i class="fas fa-trash" /> Löschen
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation (embed token) -->
    <div v-if="embedDeleteTarget" class="sm-modal-overlay" @click.self="embedDeleteTarget = null">
      <div class="sm-modal sm-confirm-modal">
        <div class="sm-modal-header">
          <h2><i class="fas fa-trash" /> Token löschen</h2>
          <button class="sm-modal-close" @click="embedDeleteTarget = null"><i class="fas fa-times" /></button>
        </div>
        <div class="sm-modal-body">
          <p style="margin:0">Token „{{ embedDeleteTarget.name }}" wirklich löschen? Alle Websites, die diesen Token nutzen, zeigen danach einen Fehler.</p>
        </div>
        <div class="sm-confirm-actions">
          <button class="sm-btn-secondary" @click="embedDeleteTarget = null">Abbrechen</button>
          <button class="sm-btn-primary sm-btn-delete-confirm" :disabled="busy" @click="executeEmbedDelete">
            <i class="fas fa-trash" /> Löschen
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GpxTrailRow, GpxTourRow, SpotRow, SpotDetailsRow, SpotStatus, AccessType, RainPolicy, NightPolicy, EmbedTokenRow } from '../../src/spot_manager/Api'
import { getEmbedTokens, getEmbedTokenTrails, deleteEmbedToken } from '../../src/spot_manager/Api'
import { processGpx, matchTrailsInTour, DIFFICULTIES, DIRECTIONS, DIFF_COLOR } from '../../src/spot_manager/GpxProcessor'
import type { ProcessedGpx } from '../../src/spot_manager/GpxProcessor'
import type { ImbaColor } from '../../src/types/MtbTypes'
import { listInvitationCodes, createInvitationCode } from '../../src/communication/invitations'
import type { InvCode } from '../../src/communication/invitations'

type View = 'selector' | 'list' | 'import' | 'edit-trail' | 'edit-tour' | 'details' | 'embed-list' | 'embed-edit'

interface PendingImport {
  key: string
  filename: string
  kind: 'trail' | 'tour'
  processed: ProcessedGpx
  name: string
  difficulty: ImbaColor
  direction: string
  trailNames: string[]
  autoDetectedTrailNames: string[]
}

const supabase = useSupabaseClient() as SupabaseClient
const authStore = useAuthStore()

// ── Layout state ──────────────────────────────────────────────────────────────
const view = ref<View>('selector')
const loading = ref(true)
const accessError = ref('')
const helpOpen = ref(false)
const busy = ref(false)

// ── Data state ────────────────────────────────────────────────────────────────
const role = computed(() => authStore.dbRole)
const spots = ref<SpotRow[]>([])
const spotId = ref('')
const spotName = ref('')
const trails = ref<GpxTrailRow[]>([])
const tours = ref<GpxTourRow[]>([])
const spotDetails = ref<SpotDetailsRow | null>(null)

// ── Embed tokens (admin only) ─────────────────────────────────────────────────
const embedTokens      = ref<EmbedTokenRow[]>([])
const embedTokenCounts = ref(new Map<string, number>())
const embedEditTarget  = ref<EmbedTokenRow | null>(null)
const embedLoading     = ref(false)
const embedError       = ref<string | null>(null)
const embedJwt         = ref('')
const embedDeleteTarget = ref<EmbedTokenRow | null>(null)

async function openEmbedList() {
  view.value    = 'embed-list'
  embedLoading.value = true
  embedError.value   = null
  try {
    embedJwt.value = await getToken()
    const tokens = await getEmbedTokens(embedJwt.value)
    embedTokens.value = tokens
    const counts = new Map<string, number>()
    await Promise.all(tokens.map(async t => {
      const linked = await getEmbedTokenTrails(t.id, embedJwt.value)
      counts.set(t.id, linked.length)
    }))
    embedTokenCounts.value = counts
  } catch (e: any) {
    embedError.value = `Fehler: ${e.message}`
  } finally {
    embedLoading.value = false
  }
}

function openEmbedEditor(token: EmbedTokenRow | null) {
  embedEditTarget.value = token
  view.value = 'embed-edit'
}

function confirmEmbedDelete(token: EmbedTokenRow) {
  embedDeleteTarget.value = token
}

async function executeEmbedDelete() {
  if (!embedDeleteTarget.value) return
  busy.value = true
  try {
    await deleteEmbedToken(embedDeleteTarget.value.id, embedJwt.value)
    embedDeleteTarget.value = null
    await openEmbedList()
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    busy.value = false
  }
}

// ── Invitation codes ─────────────────────────────────────────────────────────
const invCodes = ref<InvCode[]>([])
const invGenerating = ref(false)
const invNewCode = ref<string | null>(null)

function formatInvDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function loadInvCodes() {
  try {
    invCodes.value = await listInvitationCodes(spotId.value, await getToken())
  } catch {
    invCodes.value = []
  }
}

async function generateInvCode() {
  invGenerating.value = true
  invNewCode.value = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    const uid = session?.user.id ?? ''
    invNewCode.value = await createInvitationCode(spotId.value, uid, token)
    await loadInvCodes()
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    invGenerating.value = false
  }
}

// ── Edit form state ───────────────────────────────────────────────────────────
const editingTrail = ref<GpxTrailRow | null>(null)
const editingTour = ref<GpxTourRow | null>(null)
const efName = ref('')
const efDiff = ref<ImbaColor>('blue')
const efDir = ref('one-way-down')
const efDuration = ref(0)
const efTrailNames = ref<string[]>([])
const efTrailDesc = ref('')
const editGpxInfo = ref('')
const editNewGpx = ref<ProcessedGpx | null>(null)

// ── Import state ──────────────────────────────────────────────────────────────
const pending = ref<PendingImport[]>([])
const isDragOver = ref(false)
const importDefaultKind = ref<'trail' | 'tour'>('trail')

// ── Delete confirm state ──────────────────────────────────────────────────────
const deleteTarget = ref<{ id: string; name: string; kind: 'trail' | 'tour' } | null>(null)

// ── Map ───────────────────────────────────────────────────────────────────────
const mapEl = ref<HTMLElement | null>(null)

interface MapViewLike {
  clear(): void
  addTrailPolyline(t: GpxTrailRow): void
  addTourPolyline(t: GpxTourRow): void
  addPendingPolyline(key: string, gpxPoints: [number, number, number][], color?: string): void
  updatePendingColor(key: string, color: string): void
  removeLayer(id: string): void
  highlight(id: string): void
  resetHighlights(): void
  fitTo(id: string): void
  fitAll(): void
  setClickHandler(fn: (id: string) => void): void
}

const mapView = shallowRef<MapViewLike | null>(null)

// ── Details editor state ──────────────────────────────────────────────────────
const sdStatus = ref<SpotStatus>('open')
const sdUseUntil = ref(false)
const sdStatusUntil = ref('')
const sdHint = ref('')
const sdAffectedIds = ref<string[]>([])
const sdAccessType = ref<AccessType>('free')
const sdDonationUrl = ref('')
const sdRules = ref<string[]>([])
const sdDescription = ref('')
const sdHasSeasonal = ref(false)
const sdSeasonalFrom = ref('')
const sdSeasonalTo = ref('')
const sdRainPolicy = ref<RainPolicy>('none')
const sdRainHours = ref(24)
const sdHasWindow = ref(false)
const sdRainFrom = ref('')
const sdRainTo = ref('')
const sdNightPolicy = ref<NightPolicy>('none')
const sdBeforeDusk = ref(60)
const sdAfterDawn = ref(60)

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'open' as SpotStatus,    icon: 'fa-circle-check',         label: 'Offen',         cls: 'open',    color: '#2e7d32' },
  { value: 'limited' as SpotStatus, icon: 'fa-triangle-exclamation', label: 'Eingeschränkt', cls: 'limited', color: '#e65100' },
  { value: 'closed' as SpotStatus,  icon: 'fa-ban',                  label: 'Gesperrt',      cls: 'closed',  color: '#c62828' },
  { value: 'unknown' as SpotStatus, icon: 'fa-circle-question',      label: 'Unbekannt',     cls: 'unknown', color: '#777777' },
]

const ACCESS_OPTIONS = [
  { value: 'free' as AccessType,       icon: 'fa-unlock',          label: 'Kostenlos',       desc: 'Freier Zugang, Spende freiwillig',     color: '#2e7d32' },
  { value: 'paid' as AccessType,       icon: 'fa-money-bill-wave', label: 'Kostenpflichtig', desc: 'Gebühr vor Ort',                       color: '#e65100' },
  { value: 'membership' as AccessType, icon: 'fa-id-card',         label: 'Mitgliedschaft',  desc: 'Vereinsmitgliedschaft erforderlich',    color: '#6a1b9a' },
]

// ── Computed ──────────────────────────────────────────────────────────────────
const currentStatusMeta = computed(() => {
  const s = spotDetails.value?.status ?? 'open'
  return STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0]
})

const detailsBannerSub = computed(() => {
  const d = spotDetails.value
  if (!d) return 'Nicht konfiguriert'
  const meta = currentStatusMeta.value
  const parts: string[] = [meta.label]
  if (d.status_until) {
    const date = new Date(d.status_until + 'T00:00:00')
    parts.push(`bis ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`)
  }
  if (d.status_hint) parts.push(d.status_hint)
  return parts.join(' · ')
})

// ── Bootstrap ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  const { MapView } = await import('../../src/spot_manager/MapView')
  mapView.value = new MapView(mapEl.value!) as MapViewLike

  try {
    const userId = authStore.user?.sub ?? ''
    if (role.value === 'admin') {
      const { data } = await supabase.from('trails').select('id,name').order('name')
      spots.value = (data ?? []) as SpotRow[]
    } else {
      const { data } = await supabase.from('trailcrew_spots')
        .select('spot_id,trails(id,name)')
        .eq('user_id', userId)
      spots.value = ((data ?? []) as any[]).map((r: any) => r.trails).filter(Boolean)
    }
  } catch (e: any) {
    accessError.value = `Fehler: ${e.message}`
  }
  loading.value = false
})

// ── Spot selection ─────────────────────────────────────────────────────────────
async function openSpot(id: string, name: string) {
  spotId.value = id
  spotName.value = name
  pending.value = []
  editingTrail.value = null
  editingTour.value = null
  mapView.value?.clear()
  view.value = 'list'
  loading.value = true

  try {
    const [{ data: t }, { data: to }, { data: d }] = await Promise.all([
      supabase.from('spot_gpx_trails').select('*').eq('spot_id', id).order('name'),
      supabase.from('spot_gpx_tours').select('*').eq('spot_id', id).order('name'),
      supabase.from('trail_details').select('*').eq('trail_id', id).limit(1),
    ])
    trails.value = (t ?? []) as GpxTrailRow[]
    tours.value = (to ?? []) as GpxTourRow[]
    spotDetails.value = (d as any)?.[0] ?? null
    trails.value.forEach(tr => mapView.value?.addTrailPolyline(tr))
    tours.value.forEach(to => mapView.value?.addTourPolyline(to))
    mapView.value?.setClickHandler(itemId => {
      mapView.value?.highlight(itemId)
      mapView.value?.fitTo(itemId)
    })
  } catch (e: any) {
    accessError.value = `Fehler: ${e.message}`
  }
  loading.value = false
}

function goBack() {
  if (view.value === 'embed-edit') {
    openEmbedList()
  } else if (view.value === 'embed-list') {
    view.value = 'selector'
  } else if (view.value === 'list') {
    mapView.value?.clear()
    view.value = 'selector'
  } else {
    cancelEdit()
  }
}

// ── Edit trail / tour ──────────────────────────────────────────────────────────
function openEditTrail(id: string) {
  const t = trails.value.find(x => x.id === id)!
  editingTrail.value = t
  efName.value = t.name
  efDiff.value = t.difficulty as ImbaColor
  efDir.value = t.direction
  efTrailDesc.value = t.trail_description ?? ''
  editGpxInfo.value = ''
  editNewGpx.value = null
  mapView.value?.highlight(id)
  mapView.value?.fitTo(id)
  view.value = 'edit-trail'
}

function openEditTour(id: string) {
  const t = tours.value.find(x => x.id === id)!
  editingTour.value = t
  efName.value = t.name
  efDir.value = t.direction
  efDuration.value = t.duration_minutes
  efTrailNames.value = [...(t.trail_names ?? [])]
  editGpxInfo.value = ''
  editNewGpx.value = null
  mapView.value?.highlight(id)
  mapView.value?.fitTo(id)
  view.value = 'edit-tour'
}

function cancelEdit() {
  editingTrail.value = null
  editingTour.value = null
  mapView.value?.removeLayer('edit-preview')
  view.value = 'list'
}

async function onEditGpx(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const content = await file.text()
  const processed = processGpx(content)
  if (!processed) return
  editNewGpx.value = processed
  editGpxInfo.value = `✓ ${processed.rawCount} → ${processed.thinnedCount} Punkte · ${processed.distance_km} km`
  const color = editingTrail.value ? (DIFF_COLOR[editingTrail.value.difficulty as ImbaColor] ?? '#888') : '#333'
  mapView.value?.addPendingPolyline('edit-preview', processed.gpxPoints, color)
  mapView.value?.fitTo('edit-preview')
}

async function saveTrailEdit() {
  const t = editingTrail.value!
  const name = efName.value.trim()
  if (!name) { alert('Name darf nicht leer sein.'); return }
  busy.value = true
  try {
    let gpx_url = t.gpx_url
    let gpxPoints = t.gpx_points
    let stats = { distance_km: t.distance_km, elevation_gain: t.elevation_gain, elevation_loss: t.elevation_loss }
    if (editNewGpx.value) {
      gpx_url = await uploadGpx(spotId.value, 'trails', `${name}.gpx`, editNewGpx.value.gpxContent)
      gpxPoints = editNewGpx.value.gpxPoints
      stats = { distance_km: editNewGpx.value.distance_km, elevation_gain: editNewGpx.value.elevation_gain, elevation_loss: editNewGpx.value.elevation_loss }
    }
    const { data, error } = await supabase.from('spot_gpx_trails')
      .update({ name, difficulty: efDiff.value, direction: efDir.value, trail_description: efTrailDesc.value.trim() || null, gpx_points: gpxPoints, gpx_url, ...stats })
      .eq('id', t.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    trails.value = trails.value.map(tr => tr.id === t.id ? (data as GpxTrailRow) : tr)
    mapView.value?.removeLayer('edit-preview')
    mapView.value?.addTrailPolyline(data as GpxTrailRow)
    cancelEdit()
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    busy.value = false
  }
}

async function saveTourEdit() {
  const t = editingTour.value!
  const name = efName.value.trim()
  if (!name) { alert('Name darf nicht leer sein.'); return }
  busy.value = true
  try {
    let gpx_url = t.gpx_url
    let gpxPoints = t.gpx_points
    let stats = { distance_km: t.distance_km, elevation_gain: t.elevation_gain, elevation_loss: t.elevation_loss }
    if (editNewGpx.value) {
      gpx_url = await uploadGpx(spotId.value, 'tours', `${name}.gpx`, editNewGpx.value.gpxContent)
      gpxPoints = editNewGpx.value.gpxPoints
      stats = { distance_km: editNewGpx.value.distance_km, elevation_gain: editNewGpx.value.elevation_gain, elevation_loss: editNewGpx.value.elevation_loss }
    }
    const { data, error } = await supabase.from('spot_gpx_tours')
      .update({ name, direction: efDir.value, duration_minutes: efDuration.value, trail_names: efTrailNames.value, gpx_points: gpxPoints, gpx_url, ...stats })
      .eq('id', t.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    tours.value = tours.value.map(to => to.id === t.id ? (data as GpxTourRow) : to)
    mapView.value?.removeLayer('edit-preview')
    mapView.value?.addTourPolyline(data as GpxTourRow)
    cancelEdit()
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    busy.value = false
  }
}

// ── Import ─────────────────────────────────────────────────────────────────────
function openImport(kind: 'trail' | 'tour') {
  importDefaultKind.value = kind
  pending.value = []
  view.value = 'import'
}

function cancelImport() {
  pending.value.forEach(p => mapView.value?.removeLayer(p.key))
  pending.value = []
  view.value = 'list'
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  handleFiles(Array.from(e.dataTransfer?.files ?? []))
}

function onFileInput(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  (e.target as HTMLInputElement).value = ''
  handleFiles(files)
}

async function handleFiles(files: File[]) {
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.gpx')) continue
    const content = await file.text()
    const processed = processGpx(content)
    if (!processed) continue

    const key = `pending-${crypto.randomUUID()}`
    let kind = importDefaultKind.value
    if (file.name.toLowerCase().includes('tour') || file.name.toLowerCase().includes('runde')) kind = 'tour'

    let autoDetectedTrailNames: string[] = []
    if (kind === 'tour' && trails.value.length > 0) {
      autoDetectedTrailNames = matchTrailsInTour(processed.rawPoints, trails.value.map(t => ({ name: t.name, rawPoints: [] })))
    }

    pending.value.push({
      key, filename: file.name, kind, processed,
      name: processed.suggestedName || file.name.replace(/\.gpx$/i, ''),
      difficulty: 'blue',
      direction: kind === 'trail' ? 'one-way-down' : 'cw',
      trailNames: [...autoDetectedTrailNames],
      autoDetectedTrailNames,
    })
    const color = kind === 'tour' ? '#333' : DIFF_COLOR['blue']
    mapView.value?.addPendingPolyline(key, processed.gpxPoints, color)
  }
  if (pending.value.length > 0) mapView.value?.fitAll()
}

function setKind(i: number, kind: 'trail' | 'tour') {
  pending.value[i].kind = kind
  pending.value[i].direction = kind === 'trail' ? 'one-way-down' : 'cw'
  const color = kind === 'tour' ? '#333' : DIFF_COLOR[pending.value[i].difficulty]
  mapView.value?.updatePendingColor(pending.value[i].key, color)
}

function updatePendingColor(i: number) {
  const p = pending.value[i]
  mapView.value?.updatePendingColor(p.key, DIFF_COLOR[p.difficulty])
}

function removePending(i: number) {
  mapView.value?.removeLayer(pending.value[i].key)
  pending.value.splice(i, 1)
}

async function applyImports() {
  if (!pending.value.length) return
  busy.value = true
  const errors: string[] = []
  for (const p of pending.value) {
    try {
      const name = p.name.trim() || p.filename.replace(/\.gpx$/i, '')
      const gpx_url = await uploadGpx(spotId.value, `${p.kind}s` as 'trails' | 'tours', `${name}.gpx`, p.processed.gpxContent)
      if (p.kind === 'trail') {
        const { data, error } = await supabase.from('spot_gpx_trails')
          .insert({ spot_id: spotId.value, name, difficulty: p.difficulty, direction: p.direction,
            distance_km: p.processed.distance_km, elevation_gain: p.processed.elevation_gain,
            elevation_loss: p.processed.elevation_loss, gpx_points: p.processed.gpxPoints, gpx_url })
          .select().single()
        if (error) throw new Error(error.message)
        trails.value.push(data as GpxTrailRow)
        mapView.value?.removeLayer(p.key)
        mapView.value?.addTrailPolyline(data as GpxTrailRow)
      } else {
        const { data, error } = await supabase.from('spot_gpx_tours')
          .insert({ spot_id: spotId.value, name, direction: p.direction,
            duration_minutes: p.processed.duration_minutes ?? 0, trail_names: p.trailNames,
            distance_km: p.processed.distance_km, elevation_gain: p.processed.elevation_gain,
            elevation_loss: p.processed.elevation_loss, gpx_points: p.processed.gpxPoints, gpx_url })
          .select().single()
        if (error) throw new Error(error.message)
        tours.value.push(data as GpxTourRow)
        mapView.value?.removeLayer(p.key)
        mapView.value?.addTourPolyline(data as GpxTourRow)
      }
    } catch (e: any) {
      errors.push(`${p.name}: ${e.message}`)
    }
  }
  busy.value = false
  pending.value = []
  if (errors.length) alert(`Fehler bei:\n${errors.join('\n')}`)
  view.value = 'list'
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(id: string, kind: 'trail' | 'tour') {
  const item = kind === 'trail'
    ? trails.value.find(t => t.id === id)
    : tours.value.find(t => t.id === id)
  if (!item) return
  deleteTarget.value = { id, name: item.name, kind }
}

async function executeDelete() {
  if (!deleteTarget.value) return
  const { id, kind } = deleteTarget.value
  busy.value = true
  try {
    const table = kind === 'trail' ? 'spot_gpx_trails' : 'spot_gpx_tours'
    const item = kind === 'trail'
      ? trails.value.find(t => t.id === id)
      : tours.value.find(t => t.id === id)
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
    if (item?.gpx_url) {
      const path = item.gpx_url.split('/gpx-files/')[1]
      if (path) {
        const { error: storageError } = await supabase.storage.from('gpx-files').remove([path])
        if (storageError) console.warn('Storage delete failed:', storageError.message)
      }
    }
    if (kind === 'trail') trails.value = trails.value.filter(t => t.id !== id)
    else tours.value = tours.value.filter(t => t.id !== id)
    mapView.value?.removeLayer(id)
    deleteTarget.value = null
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    busy.value = false
  }
}

// ── Details editor ────────────────────────────────────────────────────────────
function openDetailsEditor() {
  const d = spotDetails.value
  sdStatus.value = d?.status ?? 'open'
  sdUseUntil.value = !!d?.status_until
  sdStatusUntil.value = d?.status_until ?? ''
  sdHint.value = d?.status_hint ?? ''
  sdAffectedIds.value = [...(d?.affected_trail_ids ?? [])]
  sdAccessType.value = d?.access_type ?? 'free'
  sdDonationUrl.value = d?.donation_url ?? ''
  sdRules.value = [...(d?.rules ?? [])]
  sdDescription.value = d?.trail_description ?? ''
  sdHasSeasonal.value = !!(d?.seasonal_from || d?.seasonal_to)
  sdSeasonalFrom.value = mmddToDdmm(d?.seasonal_from)
  sdSeasonalTo.value = mmddToDdmm(d?.seasonal_to)
  sdRainPolicy.value = d?.rain_policy ?? 'none'
  sdRainHours.value = d?.rain_closed_hours ?? 24
  sdHasWindow.value = !!(d?.rain_window_from || d?.rain_window_to)
  sdRainFrom.value = mmddToDdmm(d?.rain_window_from)
  sdRainTo.value = mmddToDdmm(d?.rain_window_to)
  sdNightPolicy.value = d?.night_policy ?? 'none'
  sdBeforeDusk.value = d?.night_before_dusk_min ?? 60
  sdAfterDawn.value = d?.night_after_dawn_min ?? 60
  invNewCode.value = null
  loadInvCodes()
  view.value = 'details'
}

async function saveDetails() {
  busy.value = true
  try {
    const row: SpotDetailsRow = {
      trail_id: spotId.value,
      status: sdStatus.value,
      status_until: sdStatus.value !== 'open' && sdUseUntil.value ? sdStatusUntil.value || undefined : undefined,
      status_hint: sdHint.value.trim(),
      affected_trail_ids: sdStatus.value === 'limited' ? sdAffectedIds.value : [],
      access_type: sdAccessType.value,
      donation_url: sdAccessType.value === 'free' ? sdDonationUrl.value.trim() || undefined : undefined,
      rules: sdRules.value.map(r => r.trim()).filter(Boolean),
      trail_description: sdDescription.value.trim(),
      seasonal_from: sdHasSeasonal.value ? ddmmToMmdd(sdSeasonalFrom.value) : undefined,
      seasonal_to: sdHasSeasonal.value ? ddmmToMmdd(sdSeasonalTo.value) : undefined,
      rain_policy: sdRainPolicy.value,
      rain_closed_hours: sdRainPolicy.value === 'after' ? sdRainHours.value : undefined,
      rain_window_from: sdRainPolicy.value === 'after' && sdHasWindow.value ? ddmmToMmdd(sdRainFrom.value) : undefined,
      rain_window_to: sdRainPolicy.value === 'after' && sdHasWindow.value ? ddmmToMmdd(sdRainTo.value) : undefined,
      night_policy: sdNightPolicy.value,
      night_before_dusk_min: sdNightPolicy.value === 'offset' ? sdBeforeDusk.value : undefined,
      night_after_dawn_min: sdNightPolicy.value === 'offset' ? sdAfterDawn.value : undefined,
    }
    const { data, error } = await supabase.from('trail_details')
      .upsert(row, { onConflict: 'trail_id' })
      .select().single()
    if (error) throw new Error(error.message)
    spotDetails.value = data as SpotDetailsRow
    view.value = 'list'
  } catch (e: any) {
    alert(`Fehler: ${e.message}`)
  } finally {
    busy.value = false
  }
}

// ── GPX upload ────────────────────────────────────────────────────────────────
async function uploadGpx(sid: string, kind: 'trails' | 'tours', filename: string, content: string): Promise<string> {
  const safe = filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
  const path = `${sid}/${kind}/${safe}`
  let { error } = await supabase.storage.from('gpx-files').upload(path, content, {
    contentType: 'application/gpx+xml', upsert: false,
  })
  if (error) {
    const { error: e2 } = await supabase.storage.from('gpx-files').update(path, content, {
      contentType: 'application/gpx+xml',
    })
    if (e2) throw new Error(`GPX upload failed: ${e2.message}`)
  }
  const { data } = supabase.storage.from('gpx-files').getPublicUrl(path)
  return data.publicUrl
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function mmddToDdmm(mmdd?: string): string {
  if (!mmdd) return ''
  const [mm, dd] = mmdd.split('-')
  return dd && mm ? `${dd}.${mm}` : ''
}

function ddmmToMmdd(ddmm: string): string | undefined {
  const m = ddmm.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!m) return undefined
  return `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
</script>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────── */
.sm-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: Arial, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f0f2f5;
}

/* ── Top bar ──────────────────────────────────────────────────────── */
.sm-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 12px 0 0;
  background: #1a1a2e;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,.35);
  border-bottom: 3px solid #2e7d32;
}
.sm-topbar-home {
  display: flex; align-items: center; justify-content: center;
  height: 100%; padding: 0 14px;
  background: rgba(255,255,255,.06);
  border-right: 1px solid rgba(255,255,255,.08);
  text-decoration: none; transition: background .15s; flex-shrink: 0;
}
.sm-topbar-home:hover { background: rgba(255,255,255,.13); }
.sm-topbar-logo-img { height: 34px; width: auto; display: block; border-radius: 4px; }
.sm-topbar-divider { width: 1px; height: 24px; background: rgba(255,255,255,.15); flex-shrink: 0; }
.sm-topbar-title { flex: 1; font-size: 15px; font-weight: 600; }
.sm-role-badge {
  font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
  padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,.15); color: #ddd;
}
.sm-back-btn {
  background: none; border: none; color: #aaa; cursor: pointer;
  font-size: 16px; padding: 4px 4px 4px 0; transition: color .15s;
}
.sm-back-btn:hover { color: #fff; }
.sm-help-btn {
  background: none; border: none; color: #aaa; cursor: pointer;
  font-size: 18px; padding: 4px 6px; transition: color .15s; line-height: 1;
}
.sm-help-btn:hover { color: #fff; }

/* Override UserAvatar to sit inline in the flex topbar */
:deep(.user-menu) {
  position: relative;
  top: auto;
  right: auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  margin-left: 4px;
  z-index: auto;
}
:deep(.user-avatar-btn) {
  width: 38px;
  height: 38px;
}
:deep(.user-avatar) {
  width: 38px;
  height: 38px;
}
:deep(.auth-login-btn) {
  background: rgba(255,255,255,.15);
  color: #f0f0f0;
  font-size: 0.72em;
}
:deep(.auth-login-btn:hover) { background: rgba(255,255,255,.25); }
:deep(.auth-signup-btn) { color: rgba(255,255,255,.6); font-size: 0.6em; }

/* ── Body split ───────────────────────────────────────────────────── */
.sm-body { display: flex; flex: 1; min-height: 0; }

/* ── Sidebar ──────────────────────────────────────────────────────── */
.sm-sidebar {
  width: 360px; flex-shrink: 0; background: #fff;
  overflow-y: auto; box-shadow: 2px 0 8px rgba(0,0,0,.08);
  display: flex; flex-direction: column;
}

/* ── Map pane ─────────────────────────────────────────────────────── */
.sm-map-pane { flex: 1; min-width: 0; position: relative; }
#sm-map { width: 100%; height: 100%; }

/* ── Spot selector ────────────────────────────────────────────────── */
.sm-spot-list { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.sm-spot-btn {
  display: flex; flex-direction: column; gap: 2px;
  background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 12px 14px; cursor: pointer; text-align: left; transition: all .15s;
}
.sm-spot-btn:hover { border-color: #0077cc; background: #f0f6ff; box-shadow: 0 2px 6px rgba(0,119,204,.12); }
.sm-spot-name { font-weight: 700; font-size: 14px; }
.sm-spot-id { font-size: 11px; color: #aaa; font-family: monospace; }

.sm-admin-section { margin-top: 16px; }
.sm-admin-divider {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
  color: #aaa; padding: 0 2px 6px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px;
}
.sm-embed-btn { border-color: #d1fae5; }
.sm-embed-btn:hover { border-color: #1b4332; background: #f0fdf4; box-shadow: 0 2px 6px rgba(27,67,50,.12); }

/* ── List view ────────────────────────────────────────────────────── */
.sm-list-view { padding: 0 0 80px; }
.sm-section { padding: 12px 12px 0; }
.sm-section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 8px; border-bottom: 1px solid #eee; margin-bottom: 8px;
}
.sm-section-header h3 { margin: 0; font-size: 13px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .4px; }
.sm-count { background: #e0e0e0; color: #666; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 5px; }
.sm-items { display: flex; flex-direction: column; gap: 6px; }
.sm-empty { font-size: 12px; color: #aaa; padding: 6px 0; margin: 0; }

.sm-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px;
  border: 1px solid #ececec; border-radius: 8px; background: #fafafa;
  transition: all .15s; cursor: pointer;
}
.sm-item:hover { background: #f0f6ff; border-color: #c0d8f0; }
.sm-item-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.sm-item-dot-tour { background: transparent !important; border: 2px dashed #888; }
.sm-item-info { flex: 1; min-width: 0; }
.sm-item-info strong { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sm-item-sub { font-size: 11px; color: #888; }
.sm-item-actions { display: flex; gap: 4px; }

/* ── Buttons ──────────────────────────────────────────────────────── */
.sm-btn-icon {
  background: none; border: 1px solid transparent; color: #666; cursor: pointer;
  font-size: 12px; padding: 4px 7px; border-radius: 5px; transition: all .15s;
}
.sm-btn-icon:hover { background: #eee; color: #333; }
.sm-btn-danger { color: #c62828; }
.sm-btn-danger:hover { background: #fdecea; border-color: #f0a0a0; color: #c62828; }
.sm-btn-add {
  display: flex; align-items: center; gap: 5px;
  background: #0077cc; color: #fff; border: none;
  padding: 5px 11px; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.sm-btn-add:hover { background: #005fa3; }
.sm-btn-primary {
  background: #0077cc; color: #fff; border: none;
  padding: 9px 18px; border-radius: 7px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 6px;
}
.sm-btn-primary:hover:not(:disabled) { background: #005fa3; }
.sm-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.sm-btn-delete-confirm { background: #c62828; }
.sm-btn-delete-confirm:hover:not(:disabled) { background: #a31e1e; }
.sm-btn-secondary {
  background: #fff; color: #555; border: 1px solid #d0d0d0;
  padding: 9px 16px; border-radius: 7px; font-size: 13px; cursor: pointer;
}
.sm-btn-secondary:hover { background: #f5f5f5; border-color: #aaa; }
.sm-btn-back {
  background: none; border: none; color: #555; cursor: pointer;
  font-size: 16px; padding: 4px 8px 4px 0;
}
.sm-btn-back:hover { color: #000; }

/* ── Edit form ────────────────────────────────────────────────────── */
.sm-edit-form { padding: 14px 14px 80px; display: flex; flex-direction: column; gap: 12px; }
.sm-form-header { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
.sm-form-header h3 { margin: 0; font-size: 14px; }
.sm-edit-form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #555; }
.sm-edit-form input[type="text"],
.sm-edit-form input[type="number"],
.sm-edit-form select,
.sm-edit-form textarea {
  border: 1px solid #d0d0d0; border-radius: 6px; padding: 8px 10px;
  font-size: 13px; color: #333; background: #fafafa; font-family: inherit;
}
.sm-edit-form input:focus, .sm-edit-form select:focus, .sm-edit-form textarea:focus { outline: none; border-color: #0077cc; background: #fff; }
.sm-edit-form textarea { resize: vertical; line-height: 1.5; }
.sm-file-label { cursor: pointer; }
.sm-gpx-info {
  font-size: 12px; color: #2e7d32; background: #f1f8e9;
  border: 1px solid #c5e1a5; border-radius: 6px; padding: 7px 10px;
}
.sm-trail-checks { display: flex; flex-direction: column; gap: 6px; }
.sm-label { font-size: 12px; font-weight: 600; color: #555; }
.sm-check-label { display: flex; align-items: center; gap: 7px; font-size: 13px; cursor: pointer; padding: 3px 0; }
.sm-check-label input { accent-color: #0077cc; width: 15px; height: 15px; }
.sm-badge-auto { font-size: 10px; background: #e3f2fd; color: #1565c0; border-radius: 4px; padding: 1px 5px; font-weight: 700; }
.sm-form-actions { display: flex; gap: 10px; padding-top: 4px; }

/* ── Import view ──────────────────────────────────────────────────── */
.sm-import-view { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.sm-dropzone {
  border: 2px dashed #c0c0c0; border-radius: 10px; background: #fafafa;
  padding: 24px 16px; text-align: center; transition: all .2s;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.sm-dropzone.drag-over { border-color: #0077cc; background: #e8f4ff; }
.sm-drop-icon { font-size: 28px; color: #bbb; }
.sm-dropzone p { margin: 0; font-size: 13px; color: #666; }
.sm-drop-browse {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.sm-pending-cards-list { display: flex; flex-direction: column; gap: 10px; }
.sm-pending-card {
  border: 1px solid #d4e6f7; border-radius: 10px; background: #f0f7ff;
  padding: 12px; display: flex; flex-direction: column; gap: 9px;
}
.sm-card-header { display: flex; justify-content: space-between; align-items: center; }
.sm-card-filename { font-size: 12px; font-weight: 700; color: #333; }
.sm-card-stats { font-size: 11px; color: #2e7d32; background: #e8f5e9; padding: 2px 7px; border-radius: 10px; }
.pk-kind-toggle { display: flex; border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden; }
.pk-kind-btn { flex: 1; background: #fff; border: none; padding: 6px; font-size: 12px; cursor: pointer; color: #555; }
.pk-kind-btn.active { background: #0077cc; color: #fff; font-weight: 700; }
.sm-pending-card label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #555; }
.sm-pending-card input[type="text"],
.sm-pending-card select {
  border: 1px solid #d0d0d0; border-radius: 6px; padding: 7px 10px; font-size: 13px; color: #333; background: #fff;
}
.sm-card-stats-row { display: flex; gap: 12px; font-size: 11px; color: #666; background: rgba(255,255,255,.7); border-radius: 6px; padding: 5px 8px; }
.sm-card-footer { display: flex; justify-content: flex-end; }
.sm-import-footer {
  position: sticky; bottom: 0; background: #fff; border-top: 1px solid #e0e0e0;
  padding: 10px 0 2px; display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px;
}

/* ── Details banner ───────────────────────────────────────────────── */
.sm-details-banner {
  display: flex; align-items: center; justify-content: space-between;
  margin: 10px 12px 4px; padding: 11px 14px;
  background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px;
  cursor: pointer; transition: all .15s; text-align: left; gap: 10px;
}
.sm-details-banner:hover { background: #f0f6ff; border-color: #b0ccf0; }
.sm-details-banner-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.sm-details-status-dot {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.status-open    { background: #e8f5e9; color: #2e7d32; }
.status-limited { background: #fff3e0; color: #e65100; }
.status-closed  { background: #fdecea; color: #c62828; }
.status-unknown { background: #f0f0f0; color: #777; }
.sm-details-banner-title { display: block; font-size: 12px; font-weight: 700; color: #333; line-height: 1.2; }
.sm-details-banner-sub { display: block; font-size: 11px; color: #777; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.sm-details-arrow { color: #bbb; font-size: 12px; flex-shrink: 0; }

/* ── Section hints ────────────────────────────────────────────────── */
.sm-section-hint {
  font-size: 11px; color: #777; line-height: 1.45;
  background: #f7f8fa; border-left: 3px solid #c0d8f0;
  margin: 0 0 8px; padding: 6px 10px; border-radius: 0 5px 5px 0;
}

/* ── Details editor ───────────────────────────────────────────────── */
.sd-editor { display: flex; flex-direction: column; gap: 0; padding: 14px 14px 100px; }
.sd-section { padding: 14px 0; border-bottom: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 10px; }
.sd-section:last-of-type { border-bottom: none; }
.sd-section-label { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #888; }
.sd-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sd-status-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.sd-status-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 8px; border-radius: 10px; cursor: pointer; transition: all .15s;
  border: 2px solid #e8e8e8; background: #fafafa; font-size: 12px; font-weight: 600; color: #555;
}
.sd-status-card:hover { border-color: var(--status-color); background: color-mix(in srgb, var(--status-color) 8%, #fff); }
.sd-status-card.active {
  border-color: var(--status-color);
  background: color-mix(in srgb, var(--status-color) 12%, #fff);
  color: var(--status-color);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--status-color) 25%, transparent);
}
.sd-status-icon { font-size: 22px; }
.sd-status-sub { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding: 10px 12px; background: #f7f9fc; border-left: 3px solid #d0d8e8; border-radius: 0 6px 6px 0; }
.sd-status-until-input { margin-top: 2px; }
.sd-sub-label { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .5px; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.sd-trail-check-list { display: flex; flex-direction: column; gap: 5px; }
.sd-check-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.sd-check-label input[type="checkbox"] { accent-color: #0077cc; width: 15px; height: 15px; flex-shrink: 0; }
.sd-trail-check-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.sd-sub-divider { height: 1px; background: #e0e0e0; margin: 4px 0; }
.sd-access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sd-access-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.sd-access-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px 8px; border-radius: 10px; cursor: pointer; transition: all .15s;
  border: 2px solid #e8e8e8; background: #fafafa; text-align: center;
}
.sd-access-card:hover { border-color: var(--access-color); background: color-mix(in srgb, var(--access-color) 7%, #fff); }
.sd-access-card.active {
  border-color: var(--access-color);
  background: color-mix(in srgb, var(--access-color) 12%, #fff);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--access-color) 22%, transparent);
}
.sd-access-icon { font-size: 20px; color: #bbb; }
.sd-access-card.active .sd-access-icon { color: var(--access-color); }
.sd-access-label { font-size: 12px; font-weight: 700; color: #444; }
.sd-access-card.active .sd-access-label { color: var(--access-color); }
.sd-access-desc { font-size: 10px; color: #999; line-height: 1.3; }
.sd-input {
  border: 1px solid #d0d0d0; border-radius: 7px; padding: 9px 12px;
  font-size: 13px; color: #333; background: #fafafa; width: 100%;
}
.sd-input:focus { outline: none; border-color: #0077cc; background: #fff; }
.sd-char-hint { font-size: 11px; color: #bbb; text-align: right; margin-top: -4px; }
.sd-toggle-row { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; font-size: 13px; color: #333; line-height: 1.4; }
.sd-toggle-row input[type="checkbox"] { margin-top: 2px; accent-color: #0077cc; width: 15px; height: 15px; flex-shrink: 0; }
.sd-sub-block { margin-top: 2px; padding: 10px 12px; background: #f7f9fc; border-left: 3px solid #c0d8f0; border-radius: 0 6px 6px 0; display: flex; flex-direction: column; gap: 10px; }
.sd-date-row { display: flex; gap: 10px; }
.sd-date-label { display: flex; flex-direction: column; gap: 4px; flex: 1; font-size: 11px; font-weight: 600; color: #666; }
.sd-radio-group { display: flex; flex-direction: column; gap: 8px; }
.sd-radio-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; cursor: pointer; }
.sd-radio-label input[type="radio"] { accent-color: #0077cc; width: 15px; height: 15px; flex-shrink: 0; }
.sd-radio-inline { flex-wrap: wrap; gap: 6px; align-items: center; }
.sd-inline-num { width: 58px; border: 1px solid #d0d0d0; border-radius: 5px; padding: 4px 6px; font-size: 13px; text-align: center; color: #333; }
.sd-inline-num:focus { outline: none; border-color: #0077cc; }
.sd-inline-num:disabled { opacity: .4; }
.sd-offset-grid { display: flex; gap: 10px; flex-direction: column; }
.sd-field-hint { margin: 0; font-size: 11px; color: #999; }
.sd-window-dates { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.sd-rules-list { display: flex; flex-direction: column; gap: 6px; }
.sd-rule-item { display: flex; align-items: flex-start; gap: 8px; background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 8px 10px; }
.sd-rule-grip { color: #ccc; font-size: 12px; flex-shrink: 0; padding-top: 2px; }
.sd-rule-input { flex: 1; border: none; background: transparent; font-size: 13px; color: #333; outline: none; min-width: 0; resize: none; overflow: hidden; line-height: 1.45; font-family: inherit; padding: 0; field-sizing: content; }
.sd-rule-input::placeholder { color: #bbb; }
.sd-rule-del { background: none; border: none; color: #ccc; cursor: pointer; padding: 2px 4px; border-radius: 4px; font-size: 13px; flex-shrink: 0; }
.sd-rule-del:hover { color: #c62828; background: #fdecea; }
.sd-add-rule-btn {
  display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
  color: #0077cc; background: #f0f6ff; border: 1px dashed #a0c8f0; border-radius: 8px;
  padding: 9px 14px; cursor: pointer; width: 100%; justify-content: center;
}
.sd-add-rule-btn:hover { background: #daeeff; border-color: #0077cc; }
.sd-textarea {
  border: 1px solid #d0d0d0; border-radius: 7px; padding: 10px 12px;
  font-size: 13px; color: #333; background: #fafafa; resize: vertical;
  min-height: 120px; width: 100%; font-family: inherit; line-height: 1.5;
}
.sd-textarea:focus { outline: none; border-color: #0077cc; background: #fff; }
.sd-save-row {
  position: sticky; bottom: 0; background: #fff; border-top: 1px solid #eee;
  padding: 12px 0 4px; display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;
}

/* ── Modals ───────────────────────────────────────────────────────── */
.sm-modal-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center;
  animation: sm-fade-in .15s ease;
}
@keyframes sm-fade-in { from { opacity: 0 } to { opacity: 1 } }
.sm-modal {
  background: #fff; border-radius: 12px; width: min(560px, 94vw); max-height: 88vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,.3);
  animation: sm-slide-up .18s ease;
}
.sm-confirm-modal { width: min(420px, 94vw); max-height: none; }
@keyframes sm-slide-up { from { transform: translateY(12px); opacity: 0 } to { transform: none; opacity: 1 } }
.sm-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 14px; border-bottom: 1px solid #eee; flex-shrink: 0;
}
.sm-modal-header h2 { margin: 0; font-size: 15px; font-weight: 700; color: #1a1a2e; display: flex; align-items: center; gap: 8px; }
.sm-modal-close { background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 5px; }
.sm-modal-close:hover { background: #eee; color: #333; }
.sm-modal-body { overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.sm-confirm-actions { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid #eee; justify-content: flex-end; }
.sm-help-step { display: flex; gap: 14px; align-items: flex-start; }
.sm-help-step-num { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: #1a1a2e; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.sm-help-step-content { flex: 1; min-width: 0; }
.sm-help-step-content h3 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: #1a1a2e; }
.sm-help-step-content p { margin: 0; font-size: 13px; color: #444; line-height: 1.55; }
.sm-help-tip { display: flex; gap: 8px; align-items: flex-start; background: #fffbea; border: 1px solid #f0d060; border-radius: 7px; padding: 9px 11px; margin-top: 10px; font-size: 12px; color: #555; line-height: 1.5; }
.sm-help-tip i { color: #e6a817; flex-shrink: 0; margin-top: 2px; }

/* ── Misc ─────────────────────────────────────────────────────────── */
.sm-spinner { width: 32px; height: 32px; margin: 40px auto; border: 3px solid #e0e0e0; border-top-color: #0077cc; border-radius: 50%; animation: sm-spin .7s linear infinite; }
@keyframes sm-spin { to { transform: rotate(360deg); } }
.sm-center-msg { text-align: center; padding: 40px 20px; color: #666; font-size: 14px; }
.sm-error { color: #c62828; }
.sm-muted { font-size: 12px; color: #aaa; }

/* ── Invitation codes ─────────────────────────────────────────────── */
.inv-new-code {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  background: #f0f9eb; border: 1px solid #b7e1a0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;
}
.inv-code-chip {
  font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: .2em; color: #2d6a1f;
}
.inv-code-meta { font-size: 11px; color: #5a8a4a; }
.inv-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.inv-row {
  display: flex; align-items: center; gap: 10px; padding: 6px 10px;
  border-radius: 6px; background: #f8f8f8; font-size: 12px;
}
.inv-row--used { opacity: .5; }
.inv-code { font-family: monospace; font-weight: 700; letter-spacing: .1em; color: #333; flex: 0 0 auto; }
.inv-expires { color: #888; flex: 1; }
.inv-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
  background: #e0f0e0; color: #2d6a1f;
}
.inv-row--used .inv-badge { background: #eee; color: #999; }

/* ── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .sm-sidebar { width: 100%; position: absolute; z-index: 500; max-height: 55vh; bottom: 0; top: auto; left: 0; right: 0; box-shadow: 0 -4px 16px rgba(0,0,0,.15); overflow-y: auto; }
  .sm-body { position: relative; flex: 1; }
  #sm-map { position: absolute; inset: 0; }
}
</style>
