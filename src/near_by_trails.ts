import { anon } from "./anon";
import { Trail } from "./types/Trail";

export function askNearbyConflict(existingTrail: Trail, onContinue: OnContinue, onCancel: OnCancel) {
    const modal = document.getElementById("nearby-modal");
    if(!modal)
        return;

    modal.classList.remove("hidden");
  
    const nearByName = document.getElementById("near-by-name");
    if(nearByName)
        nearByName.textContent = existingTrail.name || 'Trail';
  
    const nearByContinue = document.getElementById("near-by-continue");
    if(nearByContinue)
        nearByContinue.onclick = () => {
          modal.classList.add("hidden");
          onContinue();
        };
    const nearByCancel = document.getElementById("near-by-cancel");
    if(nearByCancel)
        nearByCancel.onclick = () => {
          modal.classList.add("hidden");
          onCancel();
        };
  }

export function giveTrailNearBy(lat: number, lng: number, trails: Trail[]) {
    const R_KM = 111.32; // km per degree lat approx
    const R = 3; // km radius
  
    const dLat = R / R_KM;
    for(const trail of trails) {
      const dLon = R / (R_KM * Math.cos(trail.latitude * Math.PI/180));
      if (Math.abs(lat - trail.latitude) <= dLat && Math.abs(lng - trail.longitude) <= dLon) 
        return trail;
    }
    return undefined;
  }

  export async function reportAbort() {
    await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/new-entry-abort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anon}`,
        },
      });
  }

type OnContinue = () => void;
type OnCancel = () => void;