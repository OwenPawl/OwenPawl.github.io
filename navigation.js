const tabs = { schedule: { file: "schedule.html", script: "table_populator.js" }, attendance: { file: "attendance.html", script: "attendance.js" } };
let activeScript = null, utilsPromise = null;
const setActiveTab = (key) => document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === key));
const ensureUtilsLoaded = () => utilsPromise ||= new Promise((resolve, reject) => {
  const script = Object.assign(document.createElement("script"), { src: "schedule_utils.js", defer: true, onload: resolve, onerror: reject });
  document.body.appendChild(script);
});

async function load(file, scriptFile, activeKey) {
  await ensureUtilsLoaded();
  document.getElementById("app").innerHTML = await fetch(file).then((r) => r.text());
  if (activeScript) activeScript.remove();
  if (scriptFile) {
    activeScript = document.createElement("script");
    Object.assign(activeScript, { src: scriptFile, defer: true });
    document.body.appendChild(activeScript);
  }
  if (activeKey) setActiveTab(activeKey);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => {
    const view = button.dataset.view, config = tabs[view];
    load(config.file, config.script, view);
  }));
  load(tabs.schedule.file, tabs.schedule.script, "schedule");
});
