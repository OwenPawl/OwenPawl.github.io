const routes = {
  schedule: { file: "schedule.html", script: "table_populator.js" },
  attendance: { file: "attendance.html", script: "attendance.js" },
  notes: { file: "notes.html", script: "notes.js" }
};

const routeByFile = Object.entries(routes).reduce((map, [key, value]) => {
  map[value.file] = key;
  return map;
}, {});

// Routes that can be swiped between (in order)
const swipeableRoutes = ["schedule", "attendance"];

// Content Cache to store pre-fetched HTML
const contentCache = new Map();

function setActiveNav(target) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });
}

function load(file, scriptFile, targetElement = document.getElementById("app")) {
  // If a view registered a cleanup function, call it only if replacing main app content
  if (targetElement.id === "app" && typeof window.cleanupView === 'function') {
    window.cleanupView();
    window.cleanupView = null;
  }

  // Check cache first
  if (contentCache.has(file)) {
    targetElement.innerHTML = contentCache.get(file);
    finalizeLoad(file, scriptFile, targetElement);
    return Promise.resolve();
  }

  return fetch(file)
    .then(r => r.text())
    .then(html => {
      contentCache.set(file, html); // Cache for future swipes
      targetElement.innerHTML = html;
      finalizeLoad(file, scriptFile, targetElement);
    });
}

function finalizeLoad(file, scriptFile, targetElement) {
  if (targetElement.id === "app") {
    setActiveNav(routeByFile[file]);
  }

  if (scriptFile) {
    const script = document.createElement("script");
    script.src = scriptFile;
    document.body.appendChild(script);
  }
}

function navigate(target) {
  if (window.location.hash === `#${target}`) {
    router();
  } else {
    window.location.hash = target;
  }
}

function router() {
  let hash = window.location.hash.slice(1);
  if (!hash || hash.startsWith("access_token")) {
    hash = "schedule";
    if (window.location.hash !== "#schedule") {
       window.location.replace("#schedule");
       return; 
    }
  }

  const route = routes[hash];
  if (route) {
    load(route.file, route.script);
  }
}

// --- SWIPE LOGIC ---
class SwipeHandler {
  constructor() {
    this.container = document.querySelector(".app-shell");
    this.appEl = document.getElementById("app");
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isSwiping = false;
    this.isScrolling = false;
    this.width = 0;
    this.targetRoute = null;
    
    // Create hidden containers for swipe
    this.prevEl = document.createElement('div');
    this.prevEl.className = 'swipe-view view-prev';
    this.nextEl = document.createElement('div');
    this.nextEl.className = 'swipe-view view-next';
    
    this.container.appendChild(this.prevEl);
    this.container.appendChild(this.nextEl);

    // Bind events
    document.addEventListener("touchstart", this.start.bind(this), { passive: false });
    document.addEventListener("touchmove", this.move.bind(this), { passive: false });
    document.addEventListener("touchend", this.end.bind(this));
  }

  start(e) {
    // 1. Check Multi-touch
    if (e.touches.length > 1) {
      this.cancel();
      return;
    }

    const currentHash = window.location.hash.slice(1) || "schedule";
    const idx = swipeableRoutes.indexOf(currentHash);
    
    // Only swipe on main tabs
    if (idx === -1) return;

    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startTime = Date.now();
    this.width = window.innerWidth;
    this.isSwiping = false;
    this.isScrolling = false;
    
    // Reset transforms just in case
    this.appEl.style.transform = '';
    this.prevEl.style.transform = '';
    this.nextEl.style.transform = '';
    this.container.classList.remove('swipe-animating');

    // Pre-load adjacent views
    this.prevRoute = idx > 0 ? swipeableRoutes[idx - 1] : null;
    this.nextRoute = idx < swipeableRoutes.length - 1 ? swipeableRoutes[idx + 1] : null;

    if (this.prevRoute) this.preload(this.prevRoute, this.prevEl);
    if (this.nextRoute) this.preload(this.nextRoute, this.nextEl);
  }

  move(e) {
    if (this.isScrolling || e.touches.length > 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - this.startX;
    const dy = y - this.startY;

    // 2. Check Dominance (First move only)
    if (!this.isSwiping) {
      if (Math.abs(dy) > Math.abs(dx)) {
        this.isScrolling = true;
        return;
      }
      // Horizontal dominance verified
      this.isSwiping = true;
      this.container.classList.add('swiping');
      this.appEl.classList.add('view-active');
    }

    if (this.isSwiping) {
      if (e.cancelable) e.preventDefault(); // Stop native scroll

      // Logic: If moving Right (dx > 0), we want Prev. If moving Left (dx < 0), we want Next.
      if (dx > 0 && !this.prevRoute) return; // Boundary
      if (dx < 0 && !this.nextRoute) return; // Boundary

      // Apply transform "Under the Finger"
      this.appEl.style.transform = `translateX(${dx}px)`;
      if (dx > 0) {
        this.prevEl.style.transform = `translateX(${dx}px)`;
      } else {
        this.nextEl.style.transform = `translateX(${dx}px)`;
      }
    }
  }

  end(e) {
    if (!this.isSwiping) return;

    const dx = e.changedTouches[0].clientX - this.startX;
    const dt = Date.now() - this.startTime;
    const velocity = Math.abs(dx) / dt;
    const percentage = Math.abs(dx) / this.width;

    // 3. Thresholds: >= 50% OR (>= 15% AND v >= 0.5)
    const passedThreshold = percentage >= 0.5 || (percentage >= 0.15 && velocity >= 0.5);
    
    this.container.classList.add('swipe-animating');

    if (passedThreshold) {
      // Complete the swipe
      const targetX = dx > 0 ? this.width : -this.width;
      const targetRoute = dx > 0 ? this.prevRoute : this.nextRoute;

      if (!targetRoute) {
        this.reset();
        return;
      }

      this.appEl.style.transform = `translateX(${targetX}px)`;
      if (dx > 0) this.prevEl.style.transform = `translateX(${targetX}px)`;
      else this.nextEl.style.transform = `translateX(${targetX}px)`;

      // Navigate after animation
      setTimeout(() => {
        navigate(targetRoute);
        this.reset();
      }, 200); // 200ms matches CSS
    } else {
      // Revert
      this.appEl.style.transform = `translateX(0px)`;
      this.prevEl.style.transform = `translateX(0px)`;
      this.nextEl.style.transform = `translateX(0px)`;
      
      setTimeout(() => this.reset(), 200);
    }
  }

  reset() {
    this.container.classList.remove('swiping', 'swipe-animating');
    this.appEl.classList.remove('view-active');
    this.appEl.style.transform = '';
    this.prevEl.style.transform = '';
    this.nextEl.style.transform = '';
    this.isSwiping = false;
  }

  cancel() {
    this.isSwiping = false;
    this.reset();
  }

  preload(routeKey, element) {
    const r = routes[routeKey];
    if (!r) return;
    
    // Just fetch content into the hidden div, don't execute scripts yet
    if (contentCache.has(r.file)) {
      element.innerHTML = contentCache.get(r.file);
    } else {
      fetch(r.file)
        .then(res => res.text())
        .then(html => {
          contentCache.set(r.file, html);
          element.innerHTML = html;
        });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      navigate(btn.dataset.target);
    });
  });

  window.addEventListener("hashchange", router);
  router();

  // Initialize Swipe
  new SwipeHandler();
});