(() => {
  const world = document.querySelector('#journeyWorld');
  const train = document.querySelector('#trainPerspective');
  const trainModel = document.querySelector('#train3d');
  const trainShadow = document.querySelector('.train-shadow');
  const trainCars = [...document.querySelectorAll('.car')];
  const panoramas = [...document.querySelectorAll('.panorama')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const progressBar = document.querySelector('#pageProgress');
  const caption = document.querySelector('#worldCaption');
  const progressLabel = document.querySelector('#worldProgress');
  const sleepers = document.querySelector('#sleepers');
  const menuToggle = document.querySelector('#menuToggle');
  const siteNav = document.querySelector('#siteNav');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const routeNames = {
    top: 'Горный маршрут · Дагестан',
    idea: 'Панорамный вагон · новая точка обзора',
    experience: 'Семь остановок · местные впечатления',
    project: 'Маршрут, который поддерживает регион',
    ai: 'ИИ · проверенные знания о поездке',
    archive: 'Проектный архив · план 2022 года',
    budget: 'Смета и ресурсы · время пересчёта',
    team: 'Команда и следующий шаг',
  };

  let activeChapter = chapters[0];
  let rafPending = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const pointOnCubic = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  };

  const drawSleepers = () => {
    if (!sleepers) return;
    const ns = 'http://www.w3.org/2000/svg';
    const left = [
      { x: -100, y: 628 }, { x: 310, y: 500 }, { x: 810, y: 730 }, { x: 1540, y: 575 },
    ];
    const right = [
      { x: -100, y: 680 }, { x: 310, y: 552 }, { x: 810, y: 782 }, { x: 1540, y: 627 },
    ];
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= 37; i += 1) {
      const t = i / 39;
      const a = pointOnCubic(...left, t);
      const b = pointOnCubic(...right, t);
      const tie = document.createElementNS(ns, 'path');
      tie.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
      tie.setAttribute('stroke-width', String(2.1 + t * 7));
      tie.setAttribute('opacity', String(.28 + t * .55));
      fragment.appendChild(tie);
    }
    sleepers.replaceChildren(fragment);
  };

  const chooseChapter = () => {
    const targetY = window.innerHeight * .54;
    let nearest = chapters[0];
    let distance = Infinity;
    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();
      const chapterCenter = rect.top + Math.min(rect.height, window.innerHeight) * .5;
      const candidateDistance = Math.abs(chapterCenter - targetY);
      if (candidateDistance < distance) {
        nearest = chapter;
        distance = candidateDistance;
      }
    });
    if (nearest !== activeChapter) {
      activeChapter?.classList.remove('is-current');
      activeChapter = nearest;
      activeChapter.classList.add('is-current');
      const sceneIndex = Number(activeChapter.dataset.scene || 0);
      panoramas.forEach((scene, index) => scene.classList.toggle('is-active', index === sceneIndex));
      if (caption) caption.textContent = routeNames[activeChapter.id] || 'Восточный экспресс';
    }
    if (progressLabel) {
      const index = chapters.indexOf(activeChapter);
      progressLabel.textContent = index <= 0
        ? 'СТАРТ'
        : `${String(index).padStart(2, '0')} / ${String(chapters.length - 1).padStart(2, '0')}`;
    }
  };

  const updateWorld = () => {
    rafPending = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp(window.scrollY / maxScroll, 0, 1);
    const movement = reducedMotion.matches ? 0 : progress;
    if (progressBar) progressBar.style.width = `${progress * 100}%`;
    chooseChapter();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = width <= 720 ? .28 : width <= 1000 ? .72 : .80;
    const trainWidth = 925 * scale;
    // Cover most of the visible rail during the page journey so each scroll
    // produces a clear change in the train's position.
    const routeT = .34 + movement * .55;
    const leftRail = pointOnCubic(
      { x: -100, y: 628 }, { x: 310, y: 500 }, { x: 810, y: 730 }, { x: 1540, y: 575 }, routeT,
    );
    const rightRail = pointOnCubic(
      { x: -100, y: 680 }, { x: 310, y: 552 }, { x: 810, y: 782 }, { x: 1540, y: 627 }, routeT,
    );
    const before = pointOnCubic(
      { x: -100, y: 654 }, { x: 310, y: 526 }, { x: 810, y: 756 }, { x: 1540, y: 601 }, Math.max(.01, routeT - .015),
    );
    const after = pointOnCubic(
      { x: -100, y: 654 }, { x: 310, y: 526 }, { x: 810, y: 756 }, { x: 1540, y: 601 }, Math.min(.99, routeT + .015),
    );
    const centerX = ((leftRail.x + rightRail.x) * .5 / 1440) * width;
    const trackFlow = movement * Math.min(380, height * .42);
    const centerY = ((leftRail.y + rightRail.y) * .5 / 1000) * height - trackFlow;
    const x = centerX - trainWidth * .5;
    const y = centerY - 168 * scale;
    const dx = (after.x - before.x) * width / 1440;
    const dy = (after.y - before.y) * height / 1000;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const yaw = -28 + movement * 56;
    const depth = 75 + Math.sin(movement * Math.PI * 2) * 145;

    if (train) {
      train.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${depth.toFixed(1)}px)`;
    }
    if (trainModel) {
      trainModel.style.setProperty('--train-scale', String(scale));
      trainModel.style.setProperty('--route-angle', `${angle.toFixed(2)}deg`);
      trainModel.style.setProperty('--route-yaw', `${yaw.toFixed(2)}deg`);
    }
    if (trainShadow) {
      trainShadow.style.transform = `translate3d(${centerX.toFixed(1)}px,${(centerY + 13 * scale).toFixed(1)}px,0) translate(-50%,-50%) scale(${Math.max(.65, scale).toFixed(2)})`;
    }
    if (trainCars.length) {
      trainCars.forEach((car, index) => {
        car.style.setProperty('--wheel-turn', `${(movement * 14400 + index * 9).toFixed(0)}deg`);
      });
    }
    if (world) {
      world.style.setProperty('--journey-progress', progress.toFixed(4));
      world.style.setProperty('--track-flow', `${(-trackFlow).toFixed(1)}px`);
      panoramas.forEach((scene, index) => {
        const pan = movement * 42 + Math.sin(movement * Math.PI * 2 + index * .7) * 5;
        scene.style.backgroundPosition = `${38 + pan}% ${46 + movement * 8}%`;
      });
    }
  };

  const requestUpdate = () => {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(updateWorld);
  };

  if (menuToggle && siteNav) {
    const closeMenu = () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      siteNav.classList.remove('is-open');
    };
    menuToggle.addEventListener('click', () => {
      const opened = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(opened));
      siteNav.classList.toggle('is-open', opened);
    });
    siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!siteNav.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
    });
  }

  if (reducedMotion.matches) {
    document.documentElement.classList.add('reduce-motion');
  }
  document.documentElement.classList.add('has-scroll-animation');

  drawSleepers();
  activeChapter?.classList.add('is-current');
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => {
    drawSleepers();
    requestUpdate();
  }, { passive: true });
  requestUpdate();
})();
