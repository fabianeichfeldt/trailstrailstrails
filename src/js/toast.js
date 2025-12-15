import "/src/css/toast.css";

export function showToast(message, type = "success", duration = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return;
  
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
  
    // Kurze Verzögerung, damit CSS-Transition greift
    requestAnimationFrame(() => toast.classList.add("show"));
  
    // Nach Ablauf wieder entfernen
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }