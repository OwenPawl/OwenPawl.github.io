document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});
function updateTable(schedule) {
  let data = JSON.parse(sessionStorage.getItem("schedule"));
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,,state, start, end, name, level, New, age] = data[i];
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
    if (state == "late_canceled"||state=="canceled"){
      merged.push({ start, end: blockEnd, name: "CANCELED", level: "&#12644;", New: false, age: "&#12644;" });
    } else {
      merged.push({ start, end: blockEnd, name: (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name).concat((New)?'<span class="badge-new">NEW</span>':''), level, age });
      
    }
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
      return [start.split(" ")[0], duration, r.name, r.level, r.age];
    }
    return [start.split(" ")[0],duration,rows.map(r => r.name),rows.map(r => r.level),rows.map(r => r.age)];
  });
  let tableRows;

  if (output.length === 0) {
    tableRows = [["No Lessons For This Day"]];
  } else {
    tableRows = [["Start", "Min.", "Name", "Lvl", "Age"], ...output];
  }
  
  const table = document.getElementById("myTable");
  
  let html = "";
  tableRows.forEach((rowData, rowIndex) => {
    html += "<tr>";
    rowData.forEach(cellData => {
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
};
updateTable(sessionStorage.getItem("schedule"));
