const tabs = {
  schedule: { file: "schedule.html", script: "table_populator.js" },
  attendance: { file: "attendance.html", script: "attendance.js" },
};

let activeScript = null;

function setActiveTab(key) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === key);
  });
}

function load(file, scriptFile, activeKey) {
  fetch(file)
    .then((r) => r.text())
    .then((html) => {
      document.getElementById("app").innerHTML = html;

      if (activeScript) {
        activeScript.remove();
        activeScript = null;
      }

      if (scriptFile) {
        const script = document.createElement("script");
        script.src = scriptFile;
        script.defer = true;
        document.body.appendChild(script);
        activeScript = script;
      }

      if (activeKey) setActiveTab(activeKey);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      const config = tabs[view];
      load(config.file, config.script, view);
    });
  });

  load(tabs.schedule.file, tabs.schedule.script, "schedule");
});
