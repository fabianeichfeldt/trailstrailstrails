document.querySelectorAll('.carousel').forEach(carousel => {
  const track = carousel.querySelector('.carousel-track');
  const dotsEl = carousel.querySelector('.carousel-dots');
  if (!track || !dotsEl) return;

  const imgs = track.querySelectorAll('img');
  imgs.forEach((_, i) => {
    const btn = document.createElement('button');
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => {
      track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' });
    });
    dotsEl.appendChild(btn);
  });

  track.addEventListener('scroll', () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    dotsEl.querySelectorAll('button').forEach((b, i) =>
      b.classList.toggle('active', i === idx));
  }, { passive: true });
});
