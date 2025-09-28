window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});
function updateTable(schedule) {
  const rows = JSON.parse(sessionStorage.getItem("schedule") || "[]");

  // group + merge in one pass, ignoring empty values
  const merged = Object.values(
    rows.reduce((acc, [,,, start, end, name, level, isNew, age]) => {
      acc[start] ??= [start, end, [], [], [], []];

      if (name)  acc[start][2].push(name);
      if (level) acc[start][3].push(level);
      if (isNew) acc[start][4].push(isNew);
      if (age !== null && age !== undefined) acc[start][5].push(age);

      return acc;
    }, {})
  ).map(([start, end, names, levels, news, ages]) => [
    start, end,
    names.join("<br>"),
    levels.join("<br>"),
    news.join("<br>"),
    ages.join("<br>")
  ]);

  const data = [["start","end","name","level","new?","age"], ...merged];

  document.getElementById("myTable").innerHTML = data
    .map((row,i) => `<tr>${row.map(cell => `<${i? "td":"th"}>${cell??""}</${i? "td":"th"}>`).join("")}</tr>`)
    .join("");
};
updateTable(sessionStorage.getItem("schedule"));
