/* ============================================================
   Машина времени — логика
   Тема оформления интерполируется непрерывно (HSL) между
   периодами по мере движения ползунка — без резких переключений.
   ============================================================ */

(function () {
  'use strict';

  const root = document.documentElement;

  const els = {
    slider: document.getElementById('year-slider'),
    ticks: document.getElementById('slider-ticks'),
    yearValue: document.getElementById('year-value'),
    agePill: document.getElementById('age-pill'),
    personName: document.getElementById('person-name'),
    scenePhoto: document.getElementById('scene-photo'),
    photo: document.getElementById('period-photo'),
    photoFallback: document.getElementById('photo-fallback'),
    photoPlaceholderText: document.getElementById('photo-placeholder-text'),
    periodEmoji: document.getElementById('period-emoji'),
    periodTitleText: document.getElementById('period-title-text'),
    periodLocation: document.getElementById('period-location'),
    periodEvents: document.getElementById('period-events'),
    finaleLine: document.getElementById('finale-line'),
    songMeta: document.getElementById('song-meta'),
    songEmbed: document.getElementById('song-embed'),
    npToggle: document.getElementById('np-toggle'),
    playBtn: document.getElementById('play-btn'),
    playIcon: document.getElementById('play-icon'),
  };

  let data = null;
  let anchors = [];
  let playing = false;
  let rafId = null;
  let lastRenderedYear = null;
  let currentSongKey = null;
  let finaleShown = false;

  fetch('data.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('data.json: ' + r.status);
      return r.json();
    })
    .then((json) => {
      data = json;
      init(json);
    })
    .catch((err) => {
      console.error('Не удалось загрузить data.json', err);
      document.querySelector('.scene').innerHTML =
        '<p style="padding:24px;text-align:center;color:#a24;font-weight:700;">' +
        'Не получилось загрузить data.json.<br>Если вы открыли файл напрямую двойным кликом — ' +
        'запустите локальный сервер (см. README.md), браузеры блокируют fetch() для file://.' +
        '</p>';
    });

  /* ---------------- цветовая интерполяция ---------------- */

  function hexToHsl(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpHsl(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function hslStr(hsl) {
    return 'hsl(' + hsl[0].toFixed(1) + ' ' + hsl[1].toFixed(1) + '% ' + hsl[2].toFixed(1) + '%)';
  }

  function buildAnchors(json) {
    return json.periods.map((p) => ({
      year: (p.startYear + p.endYear) / 2,
      c1: hexToHsl(p.colors[0]),
      c2: hexToHsl(p.colors[1]),
    }));
  }

  function themeAt(yearFloat) {
    if (yearFloat <= anchors[0].year) return anchors[0];
    const last = anchors[anchors.length - 1];
    if (yearFloat >= last.year) return last;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i],
        b = anchors[i + 1];
      if (yearFloat >= a.year && yearFloat <= b.year) {
        const t = (yearFloat - a.year) / (b.year - a.year || 1);
        return { c1: lerpHsl(a.c1, b.c1, t), c2: lerpHsl(a.c2, b.c2, t) };
      }
    }
    return anchors[0];
  }

  function accentFrom(hsl) {
    return [hsl[0], 68, 50];
  }

  function applyTheme(yearFloat) {
    const theme = themeAt(yearFloat);
    root.style.setProperty('--c1', hslStr(theme.c1));
    root.style.setProperty('--c2', hslStr(theme.c2));
    root.style.setProperty('--accent', hslStr(accentFrom(theme.c1)));
    root.style.setProperty('--accent-2', hslStr(accentFrom(theme.c2)));
  }

  function buildSliderGradient(json) {
    const total = json.endYear - json.startYear || 1;
    const stops = [];
    json.periods.forEach((p) => {
      const posStart = (((p.startYear - json.startYear) / total) * 100).toFixed(1);
      const posEnd = (((p.endYear - json.startYear) / total) * 100).toFixed(1);
      stops.push(p.colors[0] + ' ' + posStart + '%');
      stops.push(p.colors[1] + ' ' + posEnd + '%');
    });
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  /* ---------------- инициализация ---------------- */

  function init(json) {
    els.personName.textContent = json.person.name;

    els.slider.min = json.startYear;
    els.slider.max = json.endYear;
    els.slider.value = json.startYear;

    anchors = buildAnchors(json);
    root.style.setProperty('--slider-track', buildSliderGradient(json));

    buildTicks(json);

    render(json.startYear);

    els.slider.addEventListener('input', () => {
      stopPlaying();
      render(parseInt(els.slider.value, 10));
    });

    els.playBtn.addEventListener('click', () => {
      if (playing) {
        stopPlaying();
      } else {
        startPlaying();
      }
    });

    els.npToggle.addEventListener('click', () => {
      const open = els.songEmbed.classList.toggle('open');
      els.npToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function buildTicks(json) {
    els.ticks.innerHTML = '';
    const range = json.endYear - json.startYear || 1;
    const years = json.periods.map((p) => p.startYear);
    years.push(json.endYear);
    const seen = new Set();
    years.forEach((y) => {
      if (seen.has(y)) return;
      seen.add(y);
      const pct = ((y - json.startYear) / range) * 100;
      const span = document.createElement('span');
      span.className = 'tick';
      span.style.left = pct + '%';
      span.textContent = y;
      els.ticks.appendChild(span);
    });
  }

  function findPeriod(json, year) {
    return (
      json.periods.find((p) => year >= p.startYear && year <= p.endYear) ||
      json.periods[json.periods.length - 1]
    );
  }

  function calcAge(birthDateStr, year) {
    const birth = new Date(birthDateStr);
    const birthYear = birth.getFullYear();
    if (year <= birthYear) return 0;
    return year - birthYear;
  }

  function pluralYears(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return 'лет';
    if (mod10 === 1) return 'год';
    if (mod10 >= 2 && mod10 <= 4) return 'года';
    return 'лет';
  }

  /* ---------------- рендер ---------------- */

  // полный рендер по целому году: тема + контент (используется при перетаскивании ползунка)
  function render(year) {
    if (!data) return;
    year = Math.max(data.startYear, Math.min(data.endYear, year));
    els.slider.value = year;
    els.yearValue.textContent = year;
    applyTheme(year);
    renderContent(year);
    lastRenderedYear = year;
  }

  // только контент периода — вызывается лишь когда меняется целый год
  function renderContent(year) {
    const birthYear = new Date(data.person.birthDate).getFullYear();
    if (year <= birthYear) {
      els.agePill.textContent = 'родилась ✨';
    } else {
      const age = calcAge(data.person.birthDate, year);
      els.agePill.textContent = 'исполнилось ' + age + ' ' + pluralYears(age);
    }

    const period = findPeriod(data, year);

    els.periodEmoji.textContent = period.emoji || '🕰️';
    els.periodTitleText.textContent = period.title;
    els.periodLocation.textContent = '📍 ' + period.location;

    els.periodEvents.innerHTML = '';
    (period.events || []).forEach((ev) => {
      const li = document.createElement('li');
      li.textContent = ev;
      els.periodEvents.appendChild(li);
    });

    setPhoto(period);
    setSong(period);

    if (year === data.endYear) {
      els.finaleLine.textContent = data.person.finalMessage;
      els.finaleLine.hidden = false;
      if (!finaleShown) {
        finaleShown = true;
        burstConfetti();
      }
    } else {
      els.finaleLine.hidden = true;
      finaleShown = false;
    }
  }

  function setPhoto(period) {
    els.photo.classList.remove('loaded');
    const yearsLabel =
      period.startYear === period.endYear
        ? String(period.startYear)
        : period.startYear + '–' + period.endYear;
    els.photoPlaceholderText.textContent = 'Добавьте фото ' + yearsLabel;

    if (!period.photo) return;

    const img = new Image();
    img.onload = () => {
      if (els.scenePhoto.dataset.currentSrc !== period.photo) return; // устарело
      els.photo.src = period.photo;
      els.photo.classList.add('loaded');
    };
    img.onerror = () => {};
    els.scenePhoto.dataset.currentSrc = period.photo;
    img.src = period.photo;
  }

  function setSong(period) {
    const song = period.song;
    if (!song) {
      els.songMeta.textContent = '—';
      els.songEmbed.innerHTML = '';
      return;
    }

    els.songMeta.textContent = song.title + ' — ' + song.artist;

    const key = period.id;
    if (currentSongKey === key) return;
    currentSongKey = key;

    const isReal =
      song.verified &&
      song.yandexTrackId &&
      song.yandexAlbumId &&
      !/REPLACE/i.test(song.yandexTrackId) &&
      !/REPLACE/i.test(song.yandexAlbumId);

    if (isReal) {
      els.songEmbed.innerHTML =
        '<iframe frameborder="0" allowfullscreen ' +
        'style="border:none" width="100%" height="180" ' +
        'src="https://music.yandex.ru/iframe/#track/' +
        encodeURIComponent(song.yandexTrackId) +
        '/' +
        encodeURIComponent(song.yandexAlbumId) +
        '"></iframe>';
    } else {
      const q = encodeURIComponent(song.artist + ' ' + song.title);
      els.songEmbed.innerHTML =
        '<div class="song-fallback">' +
        'Виджет ещё не подключён. Найдите трек на ' +
        '<a href="https://music.yandex.ru/search?text=' +
        q +
        '" target="_blank" rel="noopener">Яндекс.Музыке</a> и добавьте ID трека/альбома в data.json.' +
        '</div>';
    }
  }

  /* ---------------- автопрокрутка ---------------- */

  function startPlaying() {
    if (!data) return;
    playing = true;
    els.playBtn.classList.add('playing');
    els.playIcon.textContent = '⏸';

    const startYear = data.startYear;
    const endYear = data.endYear;
    const duration = Math.min(14000, Math.max(5000, (endYear - startYear) * 130));
    let startTs = null;

    function frame(ts) {
      if (!playing) return;
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const yearFloat = startYear + t * (endYear - startYear);

      applyTheme(yearFloat);
      els.slider.value = Math.round(yearFloat);
      els.yearValue.textContent = Math.round(yearFloat);

      const yearInt = Math.round(yearFloat);
      if (yearInt !== lastRenderedYear) {
        renderContent(yearInt);
        lastRenderedYear = yearInt;
      }

      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        render(endYear);
        stopPlaying();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function stopPlaying() {
    playing = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    els.playBtn.classList.remove('playing');
    els.playIcon.textContent = '▶';
  }

  function burstConfetti() {
    const colors = ['#ff9dc2', '#8bb8ff', '#ffd7e6', '#c9e4ff', '#ffe27a'];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const duration = 2.4 + Math.random() * 1.6;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = Math.random() * 0.4 + 's';
      piece.style.opacity = String(0.7 + Math.random() * 0.3);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + 0.5) * 1000);
    }
  }
})();
