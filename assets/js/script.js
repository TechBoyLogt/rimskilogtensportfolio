(function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var themeToggle = document.getElementById('themeToggle');
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) {}

  if (stored === 'dark' || stored === 'light') {
    root.setAttribute('data-theme', stored);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var current = root.getAttribute('data-theme') || (prefersDark ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  // Split the hero name into letters for the flip-in and wave animation.
  // The h1 keeps its full name as an aria-label, so it still reads as one word.
  var heroName = document.getElementById('heroName');
  if (heroName) {
    var text = heroName.textContent.trim();
    var index = 0;
    heroName.setAttribute('aria-label', text);
    heroName.textContent = '';
    text.split(' ').forEach(function (word, w) {
      if (w > 0) heroName.appendChild(document.createTextNode(' '));
      var wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.setAttribute('aria-hidden', 'true');
      word.split('').forEach(function (ch) {
        var outer = document.createElement('span');
        var inner = document.createElement('span');
        outer.className = 'l';
        outer.style.setProperty('--i', index++);
        inner.textContent = ch;
        outer.appendChild(inner);
        wordEl.appendChild(outer);
      });
      heroName.appendChild(wordEl);
    });
  }

  // Header logo turns into "RL" once the big hero name has scrolled out of view
  var header = document.querySelector('.site-header');
  if (header && heroName && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var nameGone = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      header.classList.toggle('is-compact', nameGone);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(heroName);
  }

  // Scroll reveal
  var revealGroups = [
    '.section-title', '.profile-card', '.about-text', '.languages li', '.skill-card',
    '.timeline-item', '.contact-links'
  ];
  var revealEls = [];
  revealGroups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      // Stagger siblings within the same group (e.g. cards in one grid)
      var i = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('reveal');
      el.style.setProperty('--delay', (Math.min(i, 6) * 0.08) + 's');
      revealEls.push(el);
    });
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Scroll progress bar + timeline line drawing
  var progressBar = document.getElementById('scrollProgress');
  var timelines = document.querySelectorAll('.timeline');
  var ticking = false;

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';

    timelines.forEach(function (tl) {
      var rect = tl.getBoundingClientRect();
      var start = window.innerHeight * 0.8;
      var p = (start - rect.top) / rect.height;
      tl.style.setProperty('--progress', Math.max(0, Math.min(1, p)).toFixed(3));
    });
    ticking = false;
  }

  if (!reduceMotion) {
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  // 3D tilt on skill cards and profile card
  function addTilt(el, strength) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', ((x - 0.5) * strength).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * strength).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100) + '%');
      el.style.setProperty('--my', (y * 100) + '%');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }

  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.skill-card').forEach(function (card) { addTilt(card, 12); });

    var profileCard = document.getElementById('profileCard');
    if (profileCard) addTilt(profileCard, 10);
  }
})();
