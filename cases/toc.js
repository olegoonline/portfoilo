/* Case table of contents — highlights the section currently being read
   and smooth-scrolls to a section when an entry is clicked.
   The markup lives in each case page; this file only adds behaviour. */
(function () {
  'use strict';

  var nav = document.querySelector('.case-toc');
  if (!nav) return;

  var HEADER_OFFSET = 96;   // where a clicked section lands, from the top
  var READING_RATIO = 0.3;  // the "currently reading" line, as a share of the viewport
  var ROW_TOLERANCE = 24;   // tops closer than this count as one grid row

  var items = [];
  Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (link) {
    var id = decodeURIComponent(link.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el) items.push({ link: link, el: el, point: 0 });
  });
  if (items.length < 2) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = -1;
  var ticking = false;

  function topOf(el) {
    return el.getBoundingClientRect().top + window.pageYOffset;
  }

  /* Numbered notes live in a two-column grid, so several entries can share
     the same document top. Splitting a shared row between its members keeps
     the highlight moving through every entry instead of skipping half. */
  function measure() {
    var tops = items.map(function (it) { return topOf(it.el); });
    var i = 0;
    while (i < items.length) {
      var j = i + 1;
      while (j < items.length && Math.abs(tops[j] - tops[i]) < ROW_TOLERANCE) j++;
      var start = tops[i];
      var end = j < items.length
        ? tops[j]
        : start + items[i].el.getBoundingClientRect().height;
      if (end <= start) end = start + 1;
      for (var k = i; k < j; k++) {
        items[k].point = start + (end - start) * ((k - i) / (j - i));
      }
      i = j;
    }
  }

  function setCurrent(index) {
    if (index === current) return;
    if (current > -1) {
      items[current].link.classList.remove('is-current');
      items[current].link.removeAttribute('aria-current');
    }
    if (index > -1) {
      items[index].link.classList.add('is-current');
      items[index].link.setAttribute('aria-current', 'true');
    }
    current = index;
  }

  function update() {
    ticking = false;
    var doc = document.documentElement;
    var line = window.pageYOffset + window.innerHeight * READING_RATIO;
    var index = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].point <= line) index = i;
      else break;
    }
    // once the page bottom is reached the last entry is always the answer
    if (window.pageYOffset + window.innerHeight >= doc.scrollHeight - 2) {
      index = items.length - 1;
    }
    setCurrent(index);
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  /* The rail's end offset depends on how tall the list is (sticky clamps
     the untransformed box, the list is drawn half a height above it), and
     CSS cannot read that — so hand it over as a custom property. */
  function publishHeight() {
    var list = nav.querySelector('.case-toc-list');
    if (!list) return;
    var h = list.getBoundingClientRect().height;
    if (h > 0) nav.style.setProperty('--toc-h', Math.round(h) + 'px');
  }

  function remeasure() {
    publishHeight();
    measure();
    schedule();
  }

  /* IntersectionObserver drives the highlight: each section reports when it
     crosses the reading band, which is far cheaper than watching every pixel
     of scroll. A passive scroll listener keeps it smooth in between. */
  var band = '-' + Math.round(READING_RATIO * 100) + '% 0px -' +
             (100 - Math.round(READING_RATIO * 100) - 1) + '% 0px';
  var observer = new IntersectionObserver(schedule, {
    rootMargin: band,
    threshold: 0
  });
  items.forEach(function (it) { observer.observe(it.el); });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);

  // images settle late and shift every section top with them
  if (window.ResizeObserver) {
    var main = document.querySelector('.case-main');
    if (main) new ResizeObserver(remeasure).observe(main);
  }

  nav.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (!link || !nav.contains(link)) return;
    var index = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].link === link) { index = i; break; }
    }
    if (index < 0) return;

    event.preventDefault();
    var target = Math.max(0, topOf(items[index].el) - HEADER_OFFSET);
    window.scrollTo({
      top: target,
      behavior: reduceMotion.matches ? 'auto' : 'smooth'
    });
    setCurrent(index);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', link.hash);
    }
  });

  remeasure();
})();
