import { submitFeedback } from "../communication/feedback";
import "../css/feedback_button.css";

export async function upVote(trailId: string, el: HTMLElement) {
    await setFeedback(trailId, true, el);
  }

export async function downVote(trailId: string, el: HTMLElement) {
    await setFeedback(trailId, false, el);
  }

  async function setFeedback(trailId: string, isUpvote: boolean, el: HTMLElement) {
    const parent = el.closest(".feedback-buttons");
    if(!parent)
        return;
    const upBtn = parent.querySelector(".up");
    const downBtn = parent.querySelector(".down");

    if(!upBtn || !downBtn)
        return;

    upBtn.classList.remove("selected");
    downBtn.classList.remove("selected");

    el.classList.add("selected");

    await submitFeedback(trailId, isUpvote);
  }