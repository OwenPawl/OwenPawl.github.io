const routes = {
  schedule: { file: "schedule.html", script: "table_populator.js" },
  attendance: { file: "attendance.html", script: "attendance.js" },
  notes: { file: "notes.html", script: "notes.js" }
};

const routeByFile = Object.entries(routes).reduce((map, [key, value]) => {
  map[value.file] = key;
  return map;
}, {});

function setActiveNav(target) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });
}

function load(file, scriptFile) {
  // If a view registered a cleanup function, call it to remove old listeners
  if (typeof window.cleanupView === 'function') {
    window.cleanupView();
    window.cleanupView = null;
  }

  fetch(file)
    .then(r => r.text())
    .then(html => {
      document.getElementById("app").innerHTML = html;
      setActiveNav(routeByFile[file]);

      if (scriptFile) {
        const script = document.createElement("script");
        script.src = scriptFile;
        // We append the script again to re-run initialization logic for the new view
        document.body.appendChild(script);
      }
    });
}

function navigate(target) {
  // Check if we are already on the target view (e.g. clicking "Next" in notes)
  if (window.location.hash === `#${target}`) {
    // Hash won't change, so hashchange event won't fire.
    // Manually trigger the router to reload the view with new data (like new noteContext).
    router();
  } else {
    // Update hash, which triggers hashchange listener
    window.location.hash = target;
  }
}

function router() {
  // Get hash, remove '#', default to 'schedule'
  let hash = window.location.hash.slice(1);
  
  // If hash is empty or contains the access_token, default to schedule
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

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      navigate(btn.dataset.target);
    });
  });

  // Listen for hash changes to handle back/forward button and manual navigation
  window.addEventListener("hashchange", router);

  // Initial load
  router();
});