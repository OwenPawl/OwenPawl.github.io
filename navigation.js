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
  fetch(file)
    .then(r => r.text())
    .then(html => {
      document.getElementById("app").innerHTML = html;
      setActiveNav(routeByFile[file]);

      if (scriptFile) {
        const script = document.createElement("script");
        script.src = scriptFile;
        script.defer = true;
        document.body.appendChild(script);
      }
    });
}

function navigate(target) {
  const route = routes[target];
  if (!route) return;
  load(route.file, route.script);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.target));
  });

  navigate("schedule");
});
