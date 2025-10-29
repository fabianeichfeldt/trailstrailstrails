export async function upVote(trailId, el) {
    await setFeedback(trailId, true, el);
  }
  
export async function downVote(trailId, el) {
    await setFeedback(trailId, false, el);
  }
  
  async function setFeedback(trailId, isUpvote, el) {
    const parent = el.closest(".feedback-buttons");
    const upBtn = parent.querySelector(".up");
    const downBtn = parent.querySelector(".down");
  
    upBtn.classList.remove("selected");
    downBtn.classList.remove("selected");
  
    el.classList.add("selected");
  
    await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/trail-details-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ",
        },
        body: JSON.stringify({trail_id: trailId, up: isUpvote}),
      });
  }