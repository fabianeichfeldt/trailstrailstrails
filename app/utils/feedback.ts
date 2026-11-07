import { submitFeedback } from "../communication/feedback";
import { showToast } from "./toast";
import "../css/feedback_button.css";

export async function upVote(trailId: string, el: HTMLElement): Promise<boolean> {
    return setFeedback(trailId, true, el);
  }

export async function downVote(trailId: string, el: HTMLElement): Promise<boolean> {
    return setFeedback(trailId, false, el);
  }

  async function setFeedback(trailId: string, isUpvote: boolean, el: HTMLElement): Promise<boolean> {
    const parent = el.closest(".feedback-buttons");
    if(!parent)
        return false;
    const upBtn = parent.querySelector(".up");
    const downBtn = parent.querySelector(".down");

    if(!upBtn || !downBtn)
        return false;

    // Selection moves optimistically; a failed vote puts the previous one back.
    const previous = [upBtn, downBtn].find((b) => b.classList.contains("selected")) ?? null;
    upBtn.classList.remove("selected");
    downBtn.classList.remove("selected");

    el.classList.add("selected");

    try {
        await submitFeedback(trailId, isUpvote);
        return true;
    } catch {
        el.classList.remove("selected");
        previous?.classList.add("selected");
        showToast("Feedback konnte nicht gesendet werden", "error");
        return false;
    }
  }