/* Cards — pointer tilt.

   Two families on the home page lean away from the cursor: the skill
   cards in the horizontal scroller and the project previews in the list.
   The look lives in styles.css (see "Cards — pointer tilt and glass
   sheen"). This file only reports the angle: it writes two custom
   properties on the hovered card and lets CSS build the transform.

     --tilt-rx / --tilt-ry   rotation in degrees, capped per family
     .is-tilting             set while the cursor is inside; CSS uses it
                             for the lift, the short follow transition
                             and the small rise in sheen opacity

   The sheen itself is pure CSS and does not track the pointer — it is a
   reflection lying on the card, and the card's own rotation is what
   moves it.

   Rules of the road:
   - the card's rect is measured on enter, not on every move; it is only
     re-measured after something has scrolled or resized underneath it
   - moves are coalesced into one requestAnimationFrame for the whole
     page, so several hovered cards still cost one write pass per frame
   - leaving drops the angles and the class, which hands the return over
     to the longer transition in CSS
   - fine pointers only, and no tilt at all under prefers-reduced-motion
     (the class is still set, so the sheen keeps its quiet hover fade)
*/
(function () {
  'use strict';

  if (!window.matchMedia) return;

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!finePointer.matches) return;

  /* Deliberately shallow: a card should read as leaning, not as a lid
     being opened. The project previews are three times the width of a
     skill card, and the same angle across that much surface reads as a
     much bigger movement — so they get less of it. Within each family
     the vertical axis gets the smaller angle, the cards being wider than
     they are tall. */
  var GROUPS = [
    { selector: '.skill',         maxRx: 3.5, maxRy: 4.5 },
    { selector: '.project-image', maxRx: 2.2, maxRy: 2.8 }
  ];

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var noMotion = reduced.matches;

  var states = [];
  var pending = [];       /* cards with a move waiting to be written */
  var frame = 0;

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    for (var i = 0; i < pending.length; i++) write(pending[i]);
    pending.length = 0;
  }

  function queue(state) {
    if (pending.indexOf(state) === -1) pending.push(state);
    schedule();
  }

  function write(state) {
    if (!state.active || noMotion) return;

    /* Scrolling moves the card under a still cursor, so the cached rect
       is thrown away and taken again — once, here, where a layout read
       is already expected, never inside the move handler. */
    if (state.stale) {
      state.rect = state.el.getBoundingClientRect();
      state.stale = false;
    }

    var r = state.rect;
    if (!r.width || !r.height) return;

    var nx = (state.x - r.left) / r.width * 2 - 1;    /* -1..1 across */
    var ny = (state.y - r.top) / r.height * 2 - 1;
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));

    /* Away from the cursor: the near edge sinks, the far edge lifts.
       Signs follow CSS rotation — rotateX(+) pushes the top edge back,
       rotateY(+) pushes the right edge back. */
    var s = state.el.style;
    s.setProperty('--tilt-rx', (-state.maxRx * ny).toFixed(2) + 'deg');
    s.setProperty('--tilt-ry', (state.maxRy * nx).toFixed(2) + 'deg');
  }

  function rest(state) {
    state.el.style.removeProperty('--tilt-rx');
    state.el.style.removeProperty('--tilt-ry');
  }

  function bind(el, maxRx, maxRy) {
    var state = {
      el: el,
      maxRx: maxRx,
      maxRy: maxRy,
      rect: null,
      x: 0,
      y: 0,
      active: false,
      stale: false
    };

    el.addEventListener('mouseenter', function (e) {
      state.rect = el.getBoundingClientRect();
      state.stale = false;
      state.active = true;
      state.x = e.clientX;
      state.y = e.clientY;
      el.classList.add('is-tilting');
      queue(state);
    }, { passive: true });

    el.addEventListener('mousemove', function (e) {
      if (!state.active) return;
      state.x = e.clientX;
      state.y = e.clientY;
      queue(state);
    }, { passive: true });

    el.addEventListener('mouseleave', function () {
      state.active = false;
      el.classList.remove('is-tilting');   /* longer transition takes over */
      rest(state);
    }, { passive: true });

    states.push(state);
  }

  for (var g = 0; g < GROUPS.length; g++) {
    var found = document.querySelectorAll(GROUPS[g].selector);
    for (var i = 0; i < found.length; i++) {
      bind(found[i], GROUPS[g].maxRx, GROUPS[g].maxRy);
    }
  }
  if (!states.length) return;

  function invalidate() {
    for (var i = 0; i < states.length; i++) {
      if (states[i].active) {
        states[i].stale = true;
        queue(states[i]);
      }
    }
  }

  var track = document.querySelector('.skills-right');
  if (track) track.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });

  /* Honour the setting if it is flipped while the page is open. */
  function onReducedChange() {
    noMotion = reduced.matches;
    for (var i = 0; i < states.length; i++) rest(states[i]);
  }
  if (reduced.addEventListener) reduced.addEventListener('change', onReducedChange);
  else if (reduced.addListener) reduced.addListener(onReducedChange);
})();

/* Edge fades on the expertise track.
   The mask is only meaningful where there is more track to reach: no
   left fade at the start, no right fade once the last card is in. Runs
   independently of the tilt above, which bails out on touch — this is
   exactly where scrolling matters most. */
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
