/* ============================================================
   Машина времени — логика
   ============================================================ */

(function () {
  'use strict';

  const els = {
    slider: document.getElementById('year-slider'),
    ticks: document.getElementById('slider-ticks'),
    yearValue: document.getElementById('year-value'),
    agePill: document.getElementById('age-pill'),
    personName: document.getElementById('person-name'),
    spanYears: document.getElementById('span-years'),
    photoFrame: document.getElementById('photo-frame'),
    photo: document.getElementById('period-photo'),
    photoPlaceholder: document.getElementById('photo-placeholder'),
    photoPlaceholderText: document.getElementById('photo-placeholder-text'),
    periodEmoji: document.getElementById('period-emoji'),
    periodTitle: document.getElementById('period-title'),
    periodLocation: document.getElementById('period-location'),
    periodEvents: document.getElementById('period-events'),
    songMeta: document.getElementById('song-meta'),
    songEmbed: document.getElementById('song-embed'),
    playBtn: document.getElementById('play-btn'),
    playIcon: document.getElementById('play-icon'),
    playLabel: document.getElementById('play-label'),
    bgA: document.getElementById('bg-layer-a'),
    bgB: document.getElementById('bg-layer-b'),
    finale: document.getElementById('finale'),
    finaleMessage: document.getElementById('finale-message'),
    floaties: document.getElementById('floaties'),
  };

  let data = null;
  let showingA = true;
  let playing = false;
  let playTimer = null;
  let finaleShown = false;
  let currentSongKey = null;

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
      document.querySelector('.console').innerHTML =
        '<p style="padding:24px;text-align:center;color:#a24;font-weight:700;">' +
        'Не получилось загрузить data.json.<br>Если вы открыли файл напрямую двойным кликом — ' +
        'запустите локальный сервер (см. README.md), браузеры блокируют fetch() для file://.' +
        '</p>';
    });

  function init(json) {
    els.personName.textContent = json.person.name;
    els.spanYears.textContent = json.endYear - json.startYear;
    els.finaleMessage.textContent = json.person.finalMessage;

    els.slider.min = json.startYear;
    els.slider.max = json.endYear;
    els.slider.value = json.startYear;

    buildTicks(json);
    spawnFloaties();

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
      span.style.position = 'absolute';
      span.textContent = y;
      els.ticks.appendChild(span);
    });
    els.ticks.style.position = 'relative';
    els.ticks.style.height = '16px';
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
    // День рождения в текущем году считаем уже наступившим (упрощённо)
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

  function render(year) {
    if (!data) return;
    year = Math.max(data.startYear, Math.min(data.endYear, year));
    els.slider.value = year;
    els.yearValue.textContent = year;

    const birthYear = new Date(data.person.birthDate).getFullYear();
    if (year <= birthYear) {
      els.agePill.textContent = 'родилась ✨';
    } else {
      const age = calcAge(data.person.birthDate, year);
      els.agePill.textContent = age + ' ' + pluralYears(age);
    }

    const period = findPeriod(data, year);
    setBackground(period.colors);

    els.periodEmoji.textContent = period.emoji || '🕰️';
    els.periodTitle.textContent = period.title;
    els.periodLocation.textContent = '📍 ' + period.location;

    els.periodEvents.innerHTML = '';
    (period.events || []).forEach((ev, i) => {
      const li = document.createElement('li');
      li.textContent = ev;
      li.style.animationDelay = i * 0.06 + 's';
      els.periodEvents.appendChild(li);
    });

    setPhoto(period);
    setSong(period);

    // финал
    if (year === data.endYear) {
      if (!finaleShown) {
        finaleShown = true;
        els.finale.classList.add('show');
        burstConfetti();
      }
    } else {
      finaleShown = false;
      els.finale.classList.remove('show');
    }
  }

  function setPhoto(period) {
    els.photo.classList.remove('loaded');
    els.photoPlaceholder.style.display = 'flex';
    const yearsLabel =
      period.startYear === period.endYear
        ? String(period.startYear)
        : period.startYear + '–' + period.endYear;
    els.photoPlaceholderText.textContent = 'Добавьте фото ' + yearsLabel;

    if (!period.photo) return;

    const img = new Image();
    img.onload = () => {
      if (els.photoFrame.dataset.currentSrc !== period.photo) return; // устарело
      els.photo.src = period.photo;
      els.photo.classList.add('loaded');
      els.photoPlaceholder.style.display = 'none';
    };
    img.onerror = () => {
      // оставляем плейсхолдер
    };
    els.photoFrame.dataset.currentSrc = period.photo;
    img.src = period.photo;
  }

  function setSong(period) {
    const song = period.song;
    if (!song) {
      els.songMeta.textContent = '—';
      els.songEmbed.innerHTML = '';
      return;
    }

    els.songMeta.textContent = song.title + ' — ' + song.artist + ' (' + song.year + ')';

    const key = period.id;
    if (currentSongKey === key) return; // не пересоздаём тот же embed
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
        '" target="_blank" rel="noopener">Яндекс.Музыке</a>, откройте его и через ' +
        '«Поделиться → Код для вставки» скопируйте ID трека/альбома в data.json ' +
        '(подробности в README.md).' +
        '</div>';
    }
  }

  function setBackground(colors) {
    const nextLayer = showingA ? els.bgB : els.bgA;
    const currLayer = showingA ? els.bgA : els.bgB;
    nextLayer.style.background =
      'linear-gradient(135deg, ' + colors[0] + ', ' + colors[1] + ')';
    requestAnimationFrame(() => {
      nextLayer.style.opacity = '1';
      currLayer.style.opacity = '0';
    });
    showingA = !showingA;
  }

  function startPlaying() {
    if (!data) return;
    playing = true;
    els.playBtn.classList.add('playing');
    els.playIcon.textContent = '⏸';
    els.playLabel.textContent = 'Остановить';

    let year = data.startYear;
    render(year);
    const totalSteps = data.endYear - data.startYear;
    const stepDelay = Math.max(120, Math.min(550, Math.round(7000 / Math.max(totalSteps, 1))));

    playTimer = setInterval(() => {
      year += 1;
      if (year > data.endYear) {
        stopPlaying();
        return;
      }
      render(year);
      if (year === data.endYear) {
        stopPlaying();
      }
    }, stepDelay);
  }

  function stopPlaying() {
    playing = false;
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    els.playBtn.classList.remove('playing');
    els.playIcon.textContent = '▶';
    els.playLabel.textContent = 'В полёт по годам';
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

  function spawnFloaties() {
    const emojis = ['✨', '💗', '🎈', '🕊️', '💫'];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const f = document.createElement('span');
      f.className = 'floaty';
      f.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      f.style.left = Math.random() * 100 + '%';
      f.style.setProperty('--drift', Math.round((Math.random() - 0.5) * 120) + 'px');
      const duration = 14 + Math.random() * 12;
      f.style.animationDuration = duration + 's';
      f.style.animationDelay = -(Math.random() * duration) + 's';
      els.floaties.appendChild(f);
    }
  }
})();
