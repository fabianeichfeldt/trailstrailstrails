import { anon } from "./anon.js";
export function askNearbyConflict(existingTrail, onContinue, onCancel) {
    const modal = document.getElementById("nearby-modal");
    modal.classList.remove("hidden");
  
    document.getElementById("nearby-name").textContent = existingTrail.name || 'Trail';
  
    document.getElementById("nearby-continue").onclick = () => {
      modal.classList.add("hidden");
      onContinue(); 
    };
    document.getElementById("nearby-cancel").onclick = () => {
      modal.classList.add("hidden");
      onCancel(); 
    };
  }

export function giveTrailNearBy(latlng, trails) {
    const R_KM = 111.32; // km per degree lat approx
    const R = 3; // km radius
  
    const dLat = R / R_KM;
    const { lat, lng } = latlng;
    
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