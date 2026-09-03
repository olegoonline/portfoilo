/* Home glow — tints the ambient background layer to match whichever
   project row you are scrolled to.

   The layer itself (.home-glow) lives in styles.css. This file builds two
   identical tint layers inside it and cross-fades their opacity: the
   outgoing colour fades out while the incoming one fades in. Only opacity
   changes, so a colour change is a compositor blend — tinting the
   gradients directly meant repainting the whole layer on every frame of
   the fade, which showed up as flicker while scrolling.

   Hero (above the list)      -> neutral mix of the five case hues
   Inside the list            -> the colour of the nearest project row
   Past the list (skills/...) -> same hue, opacity eased down to 0
*/
(function () {
  'use strict';

  var layer = document.querySelector('.home-glow');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.project-row'));
  if (!layer || !rows.length) return;

  /* Case hues, matched by the href of the row's card so that reordering the
     list on the page cannot desync the mapping. `weight` scales the alpha:
     white reads brighter than a saturated hue at the same alpha. */
  var CASES = [
    { match: 'igaming-platform',    rgb: '255 255 255', weight: 0.80 },
    { match: 'dream-islands',       rgb: '48 209 88',   weight: 1 },
    { match: 'huawei-petal-search', rgb: '20 197 224',  weight: 1 },
    { match: 'last-level',          rgb: '255 62 80',   weight: 0.95 },
    { match: 'oasis',               rgb: '99 230 226',  weight: 1 }
  ];

  var NEUTRAL = { rgb: '135 191 175', weight: 0.9 };   /* average of the five */

  function toneOf(row) {
    var link = row.querySelector('a[href]');
    var href = link ? link.getAttribute('href') : '';
    for (var i = 0; i < CASES.length; i++) {
      if (href.indexOf(CASES[i].match) !== -1) return CASES[i];
    }
    return NEUTRAL;
  }

  var tones = rows.map(toneOf);

  /* --- the two cross-fading tint layers ------------------------------- */

  function makeTint(tone, on) {
    var el = document.createElement('div');
    el.className = 'home-glow-tint' + (on ? ' is-on' : '');
    el.style.setProperty('--glow-color', tone.rgb);
    return el;
  }

  var tints = [makeTint(NEUTRAL, true), makeTint(NEUTRAL, false)];
  /* class set before insertion, so the first paint is already lit rather
     than fading in from nothing */
  layer.appendChild(tints[0]);
  layer.appendChild(tints[1]);

  var front = 0;                 /* index of the tint currently faded in */
  var current = NEUTRAL;

  function paint(tone, strength) {
    if (tone !== current) {
      var back = 1 - front;
      tints[back].style.setProperty('--glow-color', tone.rgb);
      tints[back].classList.add('is-on');
      tints[front].classList.remove('is-on');
      front = back;
      current = tone;
    }
    layer.style.opacity = (tone.weight * strength).toFixed(3);
  }

  /* --- which row are we on -------------------------------------------- */

  /* A row counts as "the one you are looking at" while it crosses this band
     around the middle of the viewport. */
  var BAND_TOP = 0.42;
  var BAND_BOTTOM = 0.58;

  /* The hero / fade-out tests use much looser thresholds than the band, so
     a few pixels of scroll near a boundary can never toggle them back and
     forth (which would read as a pulse). */
  var HERO_EDGE = 0.75;
  var TAIL_EDGE = 0.10;

  function activeRow() {
    var bandTop = window.innerHeight * BAND_TOP;
    var bandBottom = window.innerHeight * BAND_BOTTOM;
    var mid = window.innerHeight / 2;
    var best = -1;
    var bestDist = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (r.bottom < bandTop || r.top > bandBottom) continue;
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function update() {
    var i = activeRow();
    if (i !== -1) {
      paint(tones[i], 1);         /* a row is crossing the band */
      return;
    }

    /* Nothing in the band — either side of the list, or in a gap between
       two rows. Gaps hold the current colour rather than flickering. */
    var h = window.innerHeight;
    var firstTop = rows[0].getBoundingClientRect().top;
    var lastBottom = rows[rows.length - 1].getBoundingClientRect().bottom;

    if (firstTop > h * HERO_EDGE) {
      paint(NEUTRAL, 1);          /* hero — the list is still well below */
    } else if (lastBottom < h * TAIL_EDGE) {
      paint(current, 0);          /* skills / about / footer — fade out */
    } else {
      paint(current, 1);          /* between two rows — hold */
    }
  }

  /* The observer is only a trigger: it fires when a row enters or leaves
     the band, and update() then reads the geometry. No scroll listener. */
  var io = new IntersectionObserver(update, {
    rootMargin: (-BAND_TOP * 100).toFixed(2) + '% 0px ' +
                (-(1 - BAND_BOTTOM) * 100).toFixed(2) + '% 0px',
    threshold: 0
  });

  rows.forEach(function (row) { io.observe(row); });

  /* The band is expressed in viewport percentages, so a resize moves it. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 150);
  }, { passive: true });

  update();
})();
