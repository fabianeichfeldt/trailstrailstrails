import {Trail} from "../js/types/Trail";
import {formatDate} from "../js/formatDate";

export function generateNews(trails: Trail[]) {
    const container = document.getElementById("news");
    if (!container) return;

    try {
        const news = [];
        for (let i = 1; i < 7; i++) {
            const newsItem = trails.at(-i);
            news.push({
                title: "Neue Trails!",
                date: newsItem?.created_at ?? Date.now().toString(),
                text: `<strong>${newsItem?.name}</strong> wurde neu aufgenommen in die Übersicht: <a id='show-last-${i}' href='#'>Link</a>`,
            });
        }
        container.innerHTML = "<h2>Neuigkeiten</h2>";

        for (const item of news) {
            const el = document.createElement("div");
            el.className = "news-item";
            el.innerHTML = `
        <time datetime="${item.date}">${formatDate(item.date)}</time>
        <p>${item.text}</p>
      `;
            container.appendChild(el);
        }
    } catch (err) {
        console.error("Error loading news:", err);
        container.innerHTML =
            "<p>⚠️ Neuigkeiten konnten nicht geladen werden.</p>";
    }
}