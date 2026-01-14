import "/src/css/nearby_modal.css";
import {anyTrailType} from "../../types/Trail";
import {showToast} from "../../toast";
import L from "leaflet";
import {IAuthService} from "../../auth/auth_service";
import {User} from "../../auth/user";

const types = {
    trail: "Trail",
    bikepark: "Bike Park",
    dirtpark: "Dirtpark/Pumptrack"
}

const popupSizing = { minWidth: "95vw", maxWidth: "450px" }

export function openCreateTrailPopup(mymap: L.Map, lat: number, lng: number, mode: anyTrailType, auth: IAuthService) {
  const marker = L.marker([lat, lng]).addTo(mymap);
    const popupContent = `
  <div class="popup-form">
    <h3>Neuer Eintrag</h3>
    <p>Bitte ${types[mode]} einfügen - einzelne Trails nur bei größeren Transfer (>5km)</p>
    <div class="type-switch">
      <label class="type-option">
        <input type="radio" id="trailTypeSwitch" name="trailType" value="trail" ${mode === 'trail' ? 'checked' : ''} disabled>
        <span class="switch-btn">Trail</span>
      </label>

      <label class="type-option">
        <input type="radio" name="trailType" value="bikepark" ${mode === 'bikepark' ? 'checked' : ''} disabled>
        <span class="switch-btn">Bike Park</span>
      </label>
      <label class="type-option">
        <input type="radio" id="trailTypeSwitch" name="trailType" value="dirtpark" ${mode === 'dirtpark' ? 'checked' : ''} disabled>
        <span class="switch-btn">Dirtpark/Pumptrack</span>
      </label>
    </div>
    <div style="display:${mode === 'dirtpark' ? 'block' : 'none'};">
      <label class="checkbox-label-explain">Was findest du hier?</label>
      <div class="multi-select">
        <label class="multi-option">
        <input type="checkbox" id="hasPumprack" name="subType" value="pumptrack">
        <span class="multi-btn">Pumptrack</span>
        </label>
        
        <label class="multi-option">
        <input type="checkbox" name="subType" id="hasDirtpark" value="dirtpark">
        <span class="multi-btn">Dirtpark</span>
        </label>
      </div>
    </div>
    <label>
      <span>Name*</span>
      <input type="text" id="trailName" placeholder="Trailname" required>
    </label>
    <label>
      <span>Website</span>
      <input type="url" id="trailUrl" placeholder="https://...">
    </label>
    <label>
      <span>Instagram vom Verein/Trailbauer</span><span class="optional"> (optional)</span>
      <input type="text" id="trailInsta" placeholder="@username">
    </label>
    <label>
      <span>Eingetragen von... (Nickname etc.)</span><span class="optional"> (optional)</span>
      <input type="text" id="trailCreator" placeholder="Dein Name oder Nick, Instagram etc.">
    </label>
    <div class="popup-actions">
    <button id="cancelTrailBtn" class="cancel">Abbrechen</button>
    <button id="saveTrailBtn" class="save">Speichern</button>
    </div>
  </div>
`;
    //@ts-expect-error
    marker.bindPopup(popupContent, popupSizing);

    marker.on("popupopen", async () => {
        const saveBtn = document.getElementById("saveTrailBtn");
        const cancelBtn = document.getElementById("cancelTrailBtn");

        let user: User | undefined;
        if (auth.loggedIn) {
          const creatorInput = document.getElementById("trailCreator") as HTMLFormElement;
          user = await auth.getUser();
          creatorInput.value = (await auth.getUser()).nickname || "";
          creatorInput.readOnly = true;
        }
        saveBtn?.addEventListener("click", async () => {
            let trail: any = {
                name: (document.getElementById("trailName") as HTMLFormElement).value.trim(),
                url: (document.getElementById("trailUrl") as HTMLFormElement).value.trim(),
                instagram: (document.getElementById("trailInsta") as HTMLFormElement).value.trim(),
                creator: (document.getElementById("trailCreator") as HTMLFormElement).value.trim(),
                latitude: lat,
                longitude: lng,
                creator_id: user?.id ?? ""
            };

            if (!trail.name) {
                alert("Bitte gib einen Namen ein.");
                return;
            }
            if (mode === 'dirtpark') {
                trail = {
                    ...trail,
                    dirtpark: (document.getElementById("hasDirtpark") as HTMLFormElement).checked,
                    pumptrack: (document.getElementById("hasPumprack") as HTMLFormElement).checked
                }

                if (!trail.pumptrack && !trail.dirtpark) {
                    alert("Bitte wähle aus ob Pumptrack oder Dirtpark vorzufinden sind.");
                    return;
                }
            }

            saveBtn.classList.add("loading");
            try {
                const endpoint = mode === 'trail' ? 'add-trail' : (mode === 'bikepark' ? 'bike-parks' : 'dirt-parks');
                await fetch(`https://trailradar.org/api/${endpoint}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(trail),
                });

                showToast("Trail erfolgreich gespeichert ✅", "success");
            } catch (err) {
                console.error("Error saving trail:", err);
                showToast("Fehler beim Speichern ❌", "error");
            } finally {
                saveBtn.classList.remove("loading");
                marker.closePopup();
            }
        });

        cancelBtn?.addEventListener("click", () => mymap.removeLayer(marker));
    });

    marker.openPopup();
}