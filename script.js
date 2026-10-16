const backgroundVideo = document.querySelector(".background__video");
const siteHeader = document.querySelector(".site-header");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateVideoPlayback() {
  if (!backgroundVideo) return;

  if (prefersReducedMotion.matches) {
    backgroundVideo.pause();
    backgroundVideo.classList.remove("is-ready");
    return;
  }

  backgroundVideo.classList.add("is-ready");
  backgroundVideo.play().catch(() => {
    // Posterbilden ligger kvar om webbläsaren blockerar automatisk uppspelning.
  });
}

function updateHeader() {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 24);
}

if (backgroundVideo?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
  updateVideoPlayback();
} else {
  backgroundVideo?.addEventListener("loadeddata", updateVideoPlayback, { once: true });
}

prefersReducedMotion.addEventListener("change", updateVideoPlayback);
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const introOverlay = document.querySelector(".intro-overlay");

if (introOverlay && document.documentElement.classList.contains("intro-playing")) {
  const skipButton = introOverlay.querySelector(".intro-overlay__skip");
  const introParts = [document.querySelector(".site-header"), document.querySelector("main")].filter(Boolean);

  introParts.forEach((part) => { part.inert = true; });

  function finishIntro() {
    document.documentElement.classList.remove("intro-playing");
    introParts.forEach((part) => { part.inert = false; });
    introOverlay.remove();
    skipButton.removeEventListener("click", finishIntro);
    window.removeEventListener("keydown", onIntroKeydown);
    prefersReducedMotion.removeEventListener("change", onIntroMotionChange);
    const heading = document.querySelector("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }

  function onIntroKeydown(event) {
    if (event.key === "Escape") finishIntro();
  }

  function onIntroMotionChange() {
    if (prefersReducedMotion.matches) finishIntro();
  }

  introOverlay.addEventListener("animationend", event => {
    if (event.target === introOverlay) finishIntro();
  });
  prefersReducedMotion.addEventListener("change", onIntroMotionChange);
  skipButton.addEventListener("click", finishIntro);
  window.addEventListener("keydown", onIntroKeydown);
  skipButton.focus({ preventScroll: true });
}

// A small client-side router: the HTML files remain usable direct entry points.
(() => {
  const pages = ['index.html', 'gaming.html', 'tech.html', 'projects.html', 'about.html'];
  const base = new URL('./', location.href);
  const initialMain = document.querySelector('main');
  if (!initialMain || !/^https?:$/.test(location.protocol)) return;

  function pageKey(url) {
    const name = url.pathname === base.pathname ? 'index.html' : url.pathname.slice(base.pathname.length);
    return url.origin === base.origin && url.pathname.startsWith(base.pathname) && pages.includes(name) && !url.search ? name : null;
  }

  let currentKey = pageKey(new URL(location.href));
  if (!currentKey) return;
  let currentMain = initialMain;
  let currentURL = new URL(location.href);
  let navigating = false;
  let requestNumber = 0;
  let navigationQueue = Promise.resolve();
  const cache = new Map();
  const images = new Map();
  const styleLoads = new Map();
  const stage = document.createElement('div');
  stage.className = 'page-flow';
  initialMain.before(stage);
  stage.append(initialMain);
  const status = document.createElement('div');
  status.className = 'flow-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);

  function rememberScroll() {
    history.replaceState({ ...history.state, flow: true, scrollY: window.scrollY }, '', location.href);
  }
  history.scrollRestoration = 'manual';
  rememberScroll();
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    if (!navigating) scrollTimer = setTimeout(() => { if (!navigating) rememberScroll(); }, 100);
  }, { passive: true });

  function preloadImages(main) {
    main.querySelectorAll('img[src]').forEach(img => {
      img.loading = 'eager';
      img.decoding = 'async';
      const source = new URL(img.getAttribute('src'), base).href;
      if (images.has(source)) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = source;
      images.set(source, image);
    });
  }

  function loadStyles(doc) {
    return Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map(link => {
      const href = new URL(link.getAttribute('href'), base).href;
      if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(existing => existing.href === href)) return;
      if (!styleLoads.has(href)) {
        styleLoads.set(href, new Promise(resolve => {
          const sheet = document.createElement('link');
          sheet.rel = 'stylesheet';
          sheet.href = href;
          sheet.onload = sheet.onerror = resolve;
          document.head.append(sheet);
        }));
      }
      return styleLoads.get(href);
    }));
  }

  function snapshot(doc, main) {
    return { main, title: doc.title, lang: doc.documentElement.lang,
      description: doc.querySelector('meta[name="description"]')?.content || '' };
  }

  async function loadPage(key) {
    if (cache.has(key)) return cache.get(key);
    const pending = (async () => {
      const response = await fetch(new URL(key, base), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Page unavailable: ${key}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const main = doc.querySelector('main');
      if (!main) throw new Error(`Missing page content: ${key}`);
      main.querySelectorAll('script').forEach(script => script.remove());
      preloadImages(main);
      initializePage(main);
      installLightbox(doc);
      await loadStyles(doc);
      return snapshot(doc, main);
    })();
    cache.set(key, pending);
    try { return await pending; }
    catch (error) { cache.delete(key); throw error; }
  }

  function updateMetadata(page, key) {
    document.title = page.title;
    document.documentElement.lang = page.lang;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = page.description;
    siteHeader?.querySelectorAll('.main-nav__link').forEach(link => {
      const active = pageKey(new URL(link.href)) === key;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function targetScroll(main, url, savedScroll) {
    if (typeof savedScroll === 'number') return savedScroll;
    if (!url.hash) return 0;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return 0; }
    const target = [...main.querySelectorAll('[id]')].find(node => node.id === id);
    if (!target) return 0;
    return Math.max(0, target.getBoundingClientRect().top + window.scrollY -
      (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0));
  }

  async function performNavigation(url, { pop = false, savedScroll } = {}, ticket) {
    const key = pageKey(url);
    let page;
    try { page = await loadPage(key); }
    catch {
      if (ticket === requestNumber) location.assign(url.href);
      return;
    }
    if (ticket !== requestNumber) return;
    navigating = true;
    clearTimeout(scrollTimer);
    closeLightbox();
    const outgoing = currentMain;
    const oldScroll = window.scrollY;
    const changed = key !== currentKey;
    const direction = pages.indexOf(key) > pages.indexOf(currentKey) ? 1 : -1;
    if (!pop) {
      rememberScroll();
      if (url.href !== currentURL.href) history.pushState({ flow: true, scrollY: 0 }, '', url);
    }
    if (changed) {
      outgoing.classList.add('flow-outgoing');
      outgoing.inert = true;
      outgoing.setAttribute('aria-hidden', 'true');
      page.main.inert = false;
      stage.append(page.main);
      currentMain = page.main;
    }
    currentKey = key;
    currentURL = url;
    updateMetadata(page, key);
    window.scrollTo({ top: targetScroll(currentMain, url, savedScroll), behavior: 'instant' });
    const newScroll = window.scrollY;
    if (changed && !prefersReducedMotion.matches && outgoing.animate) {
      stage.classList.add('is-transitioning');
      const options = { duration: 360, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'both' };
      const animations = [
        outgoing.animate([
          { transform: `translate(0, ${newScroll - oldScroll}px)`, opacity: 1 },
          { transform: `translate(${-direction * 100}vw, ${newScroll - oldScroll}px)`, opacity: 0 }
        ], options),
        currentMain.animate([
          { transform: `translateX(${direction * 100}vw)`, opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ], options)
      ];
      await Promise.allSettled(animations.map(animation => animation.finished));
      animations.forEach(animation => animation.cancel());
    }
    if (changed) {
      outgoing.remove();
      outgoing.classList.remove('flow-outgoing');
      outgoing.removeAttribute('aria-hidden');
      outgoing.inert = false;
    }
    stage.classList.remove('is-transitioning');
    let anchorID;
    try { anchorID = decodeURIComponent(url.hash.slice(1)); } catch { anchorID = ''; }
    const anchor = anchorID && [...currentMain.querySelectorAll('[id]')].find(node => node.id === anchorID);
    const heading = anchor || currentMain.querySelector('h1') || currentMain;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    status.textContent = page.title;
    navigating = false;
    if (ticket === requestNumber) rememberScroll();
    updateHeader();
  }

  function navigate(url, options) {
    const ticket = ++requestNumber;
    clearTimeout(scrollTimer);
    navigating = true;
    navigationQueue = navigationQueue.then(() => performNavigation(url, options, ticket)).catch(() => {
      if (ticket === requestNumber) location.assign(url.href);
    });
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.hasAttribute('data-no-flow')) return;
    const url = new URL(link.href);
    if (!pageKey(url)) return;
    event.preventDefault();
    navigate(url);
  });
  window.addEventListener('popstate', event => {
    const url = new URL(location.href);
    if (pageKey(url)) navigate(url, { pop: true, savedScroll: event.state?.scrollY });
    else location.reload();
  });

  // Initialize each cached page once. Keeping its DOM also preserves local state.
  function initializePage(main) {
    main.querySelectorAll('.copy-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const original = button.textContent;
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          button.textContent = 'Copied';
        } catch { button.textContent = 'Error'; }
        setTimeout(() => { button.textContent = original; }, 1500);
      });
    });
    main.querySelectorAll('.gallery').forEach(gallery => {
      const links = [...gallery.querySelectorAll('a')];
      links.forEach((link, index) => link.addEventListener('click', event => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openLightbox(links, index, link);
      }));
    });
    main.querySelectorAll('[id^="chat-"]').forEach(async container => {
      try {
        const response = await fetch(new URL(`data/${container.id}.json`, base), { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Chat unavailable');
        const messages = await response.json();
        container.replaceChildren();
        if (!messages.length) container.textContent = 'No messages yet.';
        messages.slice(-5).forEach(message => {
          const item = document.createElement('div');
          item.className = 'chat-msg';
          const header = document.createElement('header');
          const author = document.createElement('strong');
          author.textContent = message.author;
          const time = document.createElement('time');
          time.textContent = new Date(message.time).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
          const text = document.createElement('p');
          text.textContent = message.text;
          header.append(author, time);
          item.append(header, text);
          container.append(item);
        });
      } catch { container.textContent = 'Chat could not be loaded.'; }
    });
  }

  let lightbox;
  let galleryLinks = [];
  let imageIndex = 0;
  let imageTrigger;
  function showImage(index) {
    imageIndex = (index + galleryLinks.length) % galleryLinks.length;
    const link = galleryLinks[imageIndex];
    const image = lightbox.querySelector('img');
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    lightbox.querySelector('figcaption').textContent = `${imageIndex + 1} / ${galleryLinks.length}`;
  }
  function openLightbox(links, index, trigger) {
    if (!lightbox) return;
    galleryLinks = links;
    imageTrigger = trigger;
    showImage(index);
    lightbox.hidden = false;
    stage.inert = true;
    if (siteHeader) siteHeader.inert = true;
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lightbox__close').focus();
  }
  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.querySelector('img').removeAttribute('src');
    stage.inert = false;
    if (siteHeader) siteHeader.inert = false;
    document.body.style.overflow = '';
    imageTrigger?.focus({ preventScroll: true });
  }
  function installLightbox(doc) {
    if (lightbox) return;
    const viewer = doc.querySelector('#lightbox');
    if (!viewer) return;
    lightbox = viewer;
    document.body.append(viewer);
    viewer.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
    viewer.querySelector('.lightbox__prev').addEventListener('click', () => showImage(imageIndex - 1));
    viewer.querySelector('.lightbox__next').addEventListener('click', () => showImage(imageIndex + 1));
    viewer.addEventListener('click', event => { if (event.target === viewer) closeLightbox(); });
  }
  document.addEventListener('keydown', event => {
    if (!lightbox || lightbox.hidden) return;
    if (['Escape', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) event.preventDefault();
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showImage(imageIndex - 1);
    if (event.key === 'ArrowRight') showImage(imageIndex + 1);
    if (event.key === 'Tab') {
      const buttons = [...lightbox.querySelectorAll('button')];
      const step = event.shiftKey ? -1 : 1;
      buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length].focus();
    }
  });

  cache.set(currentKey, Promise.resolve(snapshot(document, initialMain)));
  installLightbox(document);
  initializePage(initialMain);
  preloadImages(initialMain);
  // Fetch every flow page right away; each image is requested only once.
  Promise.allSettled(pages.filter(key => key !== currentKey).map(loadPage)).then(results => {
    document.documentElement.dataset.flowReady = results.every(result => result.status === 'fulfilled') ? 'true' : 'partial';
  });
})();
