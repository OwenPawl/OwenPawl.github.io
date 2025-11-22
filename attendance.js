document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function normalizeSchedule(scheduleData) {
  if (Array.isArray(scheduleData)) return scheduleData;
  if (typeof scheduleData === "string" && scheduleData.trim()) {
    try { return JSON.parse(scheduleData); } catch (e) { console.error("Unable to parse schedule", e); }
  }
  const stored = sessionStorage.getItem("schedule");
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.error("Unable to parse stored schedule", e); }
  }
  return [];
}

function updateTable(schedule){
  const data = normalizeSchedule(schedule)
    .filter(item => (item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,""].includes(item[0])))
    .map(i => i.slice(0,7));
  if (!data.length) {
    document.getElementById("myTable").innerHTML = "<tr><th>No Events</th></tr>";
    return;
  }
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,vid,state, start, end, name, level] = data[i];
    let blockEnd = end;
    let vids = [vid];
    let states=[state];
    let j = i + 1;
    while (
      j < data.length &&
      data[j][0] === id &&
      data[j][3] === blockEnd // next start matches previous end
    ) {
      blockEnd = data[j][4];
      vids.push(data[j][1]);
      states.push(data[j][2]);
      j++;
    }
    merged.push({start,end: blockEnd,name: (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name),level,id,vids,states});
    i = j;
  }
  const getStateColor = (states) => {
    if (states.some(state => state === "noshowed")) return "#850000";
    if (states.some(state => state === "completed")) return "#00833D";
    return "#0b2a3c";
  };

  let html="<tr><th>Name</th><th>Attendance</th><th>Notes</th></tr>";
  for (let i = 0; i < merged.length; i++){
    const attendanceButtons = merged[i].vids.map((vid, idx) => {
      const state = merged[i].states[idx];
      const isNoShow = state === "noshowed";
      const selection = isNoShow ? "noshow" : "complete";
      return `<button class="checkIn" data-visit="${vid}" data-state="${state}" data-selection="${selection}" style="background-color:${isNoShow ? "#850000" : "#00833D"};" onclick='const isNoShow = this.getAttribute("data-selection") !== "noshow"; this.textContent = isNoShow ? "No Show" : "Check In"; this.style.backgroundColor = isNoShow ? "#850000" : "#00833D"; this.setAttribute("data-selection", isNoShow ? "noshow" : "complete");'>${isNoShow ? "No Show" : "Check In"}</button>`;
    }).join("");

    html+=`<tr><td><div class="text" style="color:${getStateColor(merged[i].states)};">${merged[i].name}</div></td><td class="attendance-actions">${attendanceButtons}</td><td class="notes-cell"><button class="checkIn" style="background-color:#007BB4;" onclick="location.href='https://mcdonaldswimschool.pike13.com/people/${merged[i].id}/notes';" id="${merged[i].id}">Notes</button></td></tr>`;
  };
  console.log((merged.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  const normalizeState = (s) => s === "noshowed" ? "noshow" : s;
  let attendance=[];
  [...document.getElementById("myTable").rows].slice(1).forEach(row=>{
    attendance=attendance.concat(([...row.cells[1].querySelectorAll("button[data-visit]")].map(btn=>({vid:btn.getAttribute("data-visit"),state:btn.getAttribute("data-state"),selection:btn.getAttribute("data-selection")}))));
  });
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Attendance() {
  if (new Date() >= new Date(document.getElementById("dateInput").value)) {
    document.getElementById("myTable").innerHTML = "<tr><th>Attendance Submitted!</th></tr>";
    const headers = {
      "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
      "Content-Type": "application/json"
    };
    // reset
    for (const v of attendance.filter(v => v.selection != normalizeState(v.state) && normalizeState(v.state) != "registered")) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: "reset" } })
      });
    }
    // update state
    for (const v of attendance.filter(v => v.selection != normalizeState(v.state))) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: v.selection } })
      });
    }
    // punch no-shows
    for (const v of attendance.filter(v => v.selection == "noshow" && normalizeState(v.state) != "noshow")) {
      await fetch(`${desk}punches`, {
        method: "POST",
        headers,
        body: JSON.stringify({ punch: { visit_id: v.vid } })
      });
    }
    await new Promise(r => setTimeout(r, 500));
    document.getElementById("dateInput").dispatchEvent(new Event("change"));
  } else {
    document.getElementById("myTable").innerHTML = "<tr><th>All Events Must Be In the Past</th></tr>";
    await new Promise(r => setTimeout(r, 2000));
    updateTable();
  }
}
  Attendance();
});
document.getElementById("reset").addEventListener("click", (event) => {
  let attendance=[];
  [...document.getElementById("myTable").rows].slice(1).forEach(row=>{
    attendance=attendance.concat(([...row.cells[1].querySelectorAll("button[data-visit]")].map(btn=>({vid:btn.getAttribute("data-visit"),state:btn.getAttribute("data-state")}))));
  });
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Reset(){
    document.getElementById("myTable").innerHTML = "<tr><th>Attendance Reset!</th></tr>";
    await Promise.allSettled(attendance.map(visit=>fetch(desk+`visits/${visit.vid}`,{body:JSON.stringify({"visit":{"state_event":"reset"}}),method:"PUT",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await new Promise(resolve => setTimeout(resolve, 500));
    document.getElementById("dateInput").dispatchEvent(new Event("change"));
  };
  Reset();
});
