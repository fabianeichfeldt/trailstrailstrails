import "/src/css/toast.css";

export function showToast(message: string, type = "success", duration = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return;
  
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
  
    requestAnimationFrame(() => toast.classList.add("show"));
  
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }