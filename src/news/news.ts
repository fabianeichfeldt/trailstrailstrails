import {Trail} from "../types/Trail";
import {formatDate} from "../formatDate";

export function generateNews(trails: Trail[]) {
    const container = document.getElementById("news");
    if (!container) return;

    try {
        container.innerHTML = "<h2>Neuigkeiten</h2>";
        for (let i = 1; i < 7; i++) {
            const newsItem = trails.at(-i);
            if (!newsItem) continue;
            const el = document.createElement("div");
            el.dataset.trailID = newsItem.id;
            el.id = `show-last-${i}`
            el.className = "news-item";
            el.innerHTML = `
        <time datetime="${newsItem.created_at}">${formatDate(newsItem.created_at)}</time>
        <p><strong>${newsItem.name}</strong> wurde neu aufgenommen in die Übersicht: <a href='#'>Link</a></p>
      `;
            container.appendChild(el);
        }
    } catch (err) {
        console.error("Error loading news:", err);
        container.innerHTML =
            "<p>⚠️ Neuigkeiten konnten nicht geladen werden.</p>";
    }
}