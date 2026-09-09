/* Edge fades on the expertise track.
   The mask is only meaningful where there is more track to reach: no
   left fade at the start, no right fade once the last card is in. */
(function () {
  var track = document.querySelector('.skills-right');
  if (!track) return;

  var frame = 0;

  function apply() {
    frame = 0;
    var max = track.scrollWidth - track.clientWidth;
    var x = track.scrollLeft;
    track.classList.toggle('is-scrolled', x > 1);
    track.classList.toggle('is-at-end', max - x <= 1);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(apply);
  }

  track.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  apply();
})();
