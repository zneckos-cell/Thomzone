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
  }

  function onIntroKeydown(event) {
    if (event.key === "Escape") finishIntro();
  }

  introOverlay.addEventListener("animationend", finishIntro, { once: true });
  skipButton.addEventListener("click", finishIntro);
  window.addEventListener("keydown", onIntroKeydown);
  skipButton.focus({ preventScroll: true });
}
