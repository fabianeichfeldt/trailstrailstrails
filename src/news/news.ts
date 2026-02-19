import {formatDateFromDate} from "../formatDate";
import {Trail} from "../types/Trail";
import { PhotoResponse } from "../communication/trails";

export class News {
  trailID: string = "";
  created_at: Date = new Date();
  trailName: string = "";
  type: "Photo" | "Trail" = "Trail";
  photoUrl: string = "";

  public constructor(news: Trail | PhotoResponse) {
    this.created_at = new Date(news.created_at);
    if ("name" in news) {
      this.trailID = news.id;
      this.trailName = news.name;
      this.type = "Trail";
    } else if ("url" in news) {
      this.trailID = news.trailID;
      this.trailName = news.trailName;
      this.photoUrl = news.url;
      this.type = "Photo";
    }
  }
}
export function generateNews(news: News[]) {
    const container = document.getElementById("news");
    if (!container) return;

    try {
        container.innerHTML = "<h2>Neuigkeiten</h2>";
        for (let i = 1; i < 7; i++) {
            const newsItem = news.at(-i);
            if (!newsItem) continue;
            const el = document.createElement("div");
            el.dataset.trailID = newsItem.trailID;
            el.id = `show-last-${i}`
            el.className = "news-item";
            el.innerHTML = (newsItem.type == "Trail") ? `
        <time datetime="${newsItem.created_at}">${formatDateFromDate(newsItem.created_at)}</time>
        <a href='#'><img width="30px" alt="neues Photo fuer einen Trail" src='/src/assets/trail.webp'/></a><p><strong>${newsItem.trailName}</strong> wurde neu aufgenommen in die Übersicht.</p>
      ` :
              `
        <time datetime="${newsItem.created_at}">${formatDateFromDate(newsItem.created_at)}</time>
        <a href='#'><img width="30px" alt="neues Photo fuer einen Trail" src='${newsItem.photoUrl}'/></a><p>Für <strong>${newsItem.trailName}</strong> wurde ein neues Foto geteilt.</p>
      `;
            container.appendChild(el);
        }
    } catch (err) {
        console.error("Error loading news:", err);
        container.innerHTML =
            "<p>⚠️ Neuigkeiten konnten nicht geladen werden.</p>";
    }
}