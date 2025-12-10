const routes = {
  schedule: { file: "schedule.html", script: "table_populator.js", renderFn: "renderSchedule" },
  attendance: { file: "attendance.html", script: "attendance.js", renderFn: "renderAttendance" },
  notes: { file: "notes.html", script: "notes.js", renderFn: "renderNotes" }
};

const routeByFile = Object.entries(routes).reduce((map, [key, value]) => {
  map[value.file] = key;
  return map;
}, {});

const swipeableRoutes = ["schedule", "attendance"];
const contentCache = new Map();
const SWIPE_THRESHOLD = 15;

// --- SCRIPT LOADER ---
function ensureScriptLoaded(routeKey) {
  const route = routes[routeKey];
  if (!route || !route.script) return Promise.resolve();

  if (route.renderFn && window[route.renderFn]) {
    return Promise.resolve();
  }

  if (document.querySelector(`script[src="${route.script}"]`)) {
    return new Promise((resolve) => {
      const poll = () => {
        if (window[route.renderFn]) resolve();
        else setTimeout(poll, 20);
      };
      poll();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = route.script;
    script.onload = () => {
        setTimeout(resolve, 10);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function setActiveNav(target) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });
}

async function load(file, scriptFile, targetElement = document.getElementById("app")) {
  if (targetElement.id === "app" && typeof window.cleanupView === 'function') {
    window.cleanupView();
    window.cleanupView = null;
  }

  let html;
  if (contentCache.has(file)) {
    html = contentCache.get(file);
  } else {
    html = await fetch(file).then(r => r.text());
    contentCache.set(file, html);
  }

  targetElement.innerHTML = html;

  if (targetElement.id === "app") {
    // Scroll to top when loading new main view
    window.scrollTo(0, 0);
    
    setActiveNav(routeByFile[file]);
    const routeKey = routeByFile[file];
    
    if (scriptFile) {
        await ensureScriptLoaded(routeKey);
    }

    const route = routes[routeKey];
    if (route && route.renderFn && window[route.renderFn]) {
        // CRITICAL FIX: Pass the element, not 'document', to enforce scoping
        window[route.renderFn](targetElement);
    } else if (routeKey === 'notes') {
        const oldScript = document.querySelector(`script[src="${scriptFile}"]`);
        if (oldScript) oldScript.remove();
        const script = document.createElement("script");
        script.src = scriptFile;
        document.body.appendChild(script);
    }
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
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isSwiping = false;
    this.isScrolling = false;
    this.width = 0;
    this.initialScroll = 0;
    
    this.prevEl = document.createElement('div');
    this.prevEl.className = 'swipe-overlay view-prev';
    this.nextEl = document.createElement('div');
    this.nextEl.className = 'swipe-overlay view-next';
    this.currentEl = document.createElement('div');
    this.currentEl.className = 'swipe-overlay view-active';
    
    document.body.appendChild(this.prevEl);
    document.body.appendChild(this.nextEl);
    document.body.appendChild(this.currentEl);

    document.addEventListener("touchstart", this.start.bind(this), { passive: false });
    document.addEventListener("touchmove", this.move.bind(this), { passive: false });
    document.addEventListener("touchend", this.end.bind(this));
  }

  cloneCurrentPage(targetEl) {
    const shell = document.querySelector('.app-shell').cloneNode(true);
    const nav = document.querySelector('.bottom-nav').cloneNode(true);
    
    let float = shell.querySelector('.floating-actions');
    if (float) {
        float.remove();
    } else {
        const domFloat = document.querySelector('.floating-actions');
        if (domFloat) float = domFloat.cloneNode(true);
    }
    
    shell.style.transform = `translateY(-${this.initialScroll}px)`;
    shell.style.marginBottom = "80px"; 

    targetEl.innerHTML = "";
    targetEl.appendChild(shell);
    targetEl.appendChild(nav);
    if (float) targetEl.appendChild(float);
  }

  async buildNextPage(routeKey, targetEl) {
    const route = routes[routeKey];
    if (!route) return;

    const shell = document.querySelector('.app-shell').cloneNode(true);
    shell.style.transform = ''; 
    const nav = document.querySelector('.bottom-nav').cloneNode(true);
    
    const navBtn = nav.querySelector(`button[data-target="${routeKey}"]`);
    if (navBtn) {
      nav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      navBtn.classList.add('active');
    }

    let html = "";
    if (contentCache.has(route.file)) {
      html = contentCache.get(route.file);
    } else {
      html = await fetch(route.file).then(r => r.text());
      contentCache.set(route.file, html);
    }

    const appContent = shell.querySelector('#app');
    appContent.innerHTML = html;

    const float = shell.querySelector('.floating-actions');
    if (float) {
        float.remove();
    }
    
    targetEl.innerHTML = "";
    targetEl.appendChild(shell);
    targetEl.appendChild(nav);
    if (float) targetEl.appendChild(float);

    await ensureScriptLoaded(routeKey);
    
    if (route.renderFn && window[route.renderFn]) {
      window[route.renderFn](targetEl);
    }
  }

  start(e) {
    if (e.touches.length > 1) { this.cancel(); return; }

    const currentHash = window.location.hash.slice(1) || "schedule";
    const idx = swipeableRoutes.indexOf(currentHash);
    if (idx === -1) return;

    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startTime = Date.now();
    this.width = window.innerWidth;
    this.initialScroll = window.scrollY;
    this.isSwiping = false;
    this.isScrolling = false;
    
    this.currentEl.style.transform = '';
    this.prevEl.style.transform = '';
    this.nextEl.style.transform = '';
    document.body.classList.remove('swiping-active');

    this.prevRoute = idx > 0 ? swipeableRoutes[idx - 1] : null;
    this.nextRoute = idx < swipeableRoutes.length - 1 ? swipeableRoutes[idx + 1] : null;

    this.cloneCurrentPage(this.currentEl);
    if (this.prevRoute) this.buildNextPage(this.prevRoute, this.prevEl);
    if (this.nextRoute) this.buildNextPage(this.nextRoute, this.nextEl);
  }

  move(e) {
    if (this.isScrolling || e.touches.length > 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - this.startX;
    const dy = y - this.startY;

    if (!this.isSwiping && !this.isScrolling) {
        if (Math.abs(dx) > Math.abs(dy)) {
            if ((dx > 0 && !this.prevRoute) || (dx < 0 && !this.nextRoute)) {
                if (e.cancelable) e.preventDefault();
                return;
            }
        }
    }

    if (!this.isSwiping) {
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < SWIPE_THRESHOLD) return; 
    }

    if (!this.isSwiping) {
      if (Math.abs(dy) > Math.abs(dx)) {
        this.isScrolling = true;
        return;
      }
      this.isSwiping = true;
      document.body.classList.add('swiping-active');
    }

    if (this.isSwiping) {
      if (e.cancelable) e.preventDefault(); 

      if (dx > 0 && !this.prevRoute) {
          this.currentEl.style.transform = `translateX(0px)`;
          return;
      }
      if (dx < 0 && !this.nextRoute) {
          this.currentEl.style.transform = `translateX(0px)`;
          return;
      }

      this.currentEl.style.transform = `translateX(${dx}px)`;
      if (dx > 0) {
        this.prevEl.style.transform = `translateX(${dx - this.width}px)`;
        this.prevEl.style.display = 'flex';
        this.nextEl.style.display = 'none';
      } else {
        this.nextEl.style.transform = `translateX(${dx + this.width}px)`;
        this.nextEl.style.display = 'flex';
        this.prevEl.style.display = 'none';
      }
    }
  }

  end(e) {
    if (!this.isSwiping) {
        this.reset();
        return;
    }

    const dx = e.changedTouches[0].clientX - this.startX;
    const dt = Date.now() - this.startTime;
    const velocity = Math.abs(dx) / dt;
    const percentage = Math.abs(dx) / this.width;

    const passedThreshold = percentage >= 0.5 || (percentage >= 0.15 && velocity >= 0.5);
    
    this.currentEl.style.transition = 'transform 200ms linear';
    this.prevEl.style.transition = 'transform 200ms linear';
    this.nextEl.style.transition = 'transform 200ms linear';

    const isValidSwipe = (dx > 0 && this.prevRoute) || (dx < 0 && this.nextRoute);

    if (passedThreshold && isValidSwipe) {
      const targetX = dx > 0 ? this.width : -this.width;
      const targetRoute = dx > 0 ? this.prevRoute : this.nextRoute;

      this.currentEl.style.transform = `translateX(${targetX}px)`;
      
      if (dx > 0) {
        this.prevEl.style.transform = `translateX(0px)`;
      } else {
        this.nextEl.style.transform = `translateX(0px)`;
      }

      setTimeout(() => {
        navigate(targetRoute);
        this.reset();
      }, 200);
    } else {
      this.currentEl.style.transform = `translateX(0px)`;
      this.prevEl.style.transform = `translateX(-100%)`;
      this.nextEl.style.transform = `translateX(100%)`;
      
      setTimeout(() => this.reset(), 200);
    }
  }

  reset() {
    document.body.classList.remove('swiping-active');
    this.currentEl.style.transition = '';
    this.prevEl.style.transition = '';
    this.nextEl.style.transition = '';
    this.prevEl.style.display = 'none';
    this.nextEl.style.display = 'none';
    this.currentEl.innerHTML = "";
    this.prevEl.innerHTML = "";
    this.nextEl.innerHTML = "";
    this.isSwiping = false;
  }

  cancel() {
    this.isSwiping = false;
    this.reset();
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

  new SwipeHandler();
});