window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});
function updateTable(schedule) {
  let data = JSON.parse(sessionStorage.getItem("schedule"));
  
  // helper for minutes difference
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,, , start, end, name, slot, attended, cost] = data[i];
    let blockEnd = end;
    let j = i + 1;
    while (
      j < data.length &&
      data[j][0] === id &&
      data[j][5] === name &&
      data[j][3] === blockEnd // next start matches previous end
    ) {
      blockEnd = data[j][4];
      j++;
    }
    merged.push({ start, end: blockEnd, name, slot, attended, cost });
    i = j;
  }
  
  // 2. Group by start time
  const groups = merged.reduce((acc, r) => {
    (acc[r.start] ??= []).push(r);
    return acc;
  }, {});
  
  // 3. Build final output
  const output = Object.entries(groups).map(([start, rows]) => {
    // duration = minutes from first start to last end (if multiple)
    const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
    if (rows.length === 1) {
      const r = rows[0];
      return [start, duration, r.name, r.slot, r.attended, r.cost];
    }
    return [start,duration,rows.map(r => r.name),rows.map(r => r.slot),rows.map(r => r.attended),rows.map(r => r.cost)];
  });

  data = [
    ["start", "end", "name", "level", "new?", "age"],
    ...(output)
  ];

  const table = document.getElementById("myTable");

  // Build HTML once for performance
  let html = "";
  data.forEach((rowData, rowIndex) => {
    html += "<tr>";
    rowData.forEach(cellData => {
      // If cellData is an array, join its elements with <br>
      let display;
      if (Array.isArray(cellData)) {
        display = cellData.map(x => (x === null || x === undefined) ? "" : x.toString()).join("<br>");
      } else {
        display = (cellData === null || cellData === undefined) ? "" : cellData.toString();
      }
      html += `<${rowIndex === 0 ? "th" : "td"}>${display}</${rowIndex === 0 ? "th" : "td"}>`;
    });
    html += "</tr>";
  });

  console.log(html);
  table.innerHTML = html;
}

updateTable(sessionStorage.getItem("schedule"));
