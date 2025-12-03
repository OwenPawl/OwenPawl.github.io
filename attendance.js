document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  console.log("Attendance scheduleUpdated event received", e.detail);
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
    .filter(item => (item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,""].includes(item[0])));
  if (!data.length) {
    document.getElementById("myTable").innerHTML = "<tr><th>No Events</th></tr>";
    return;
  }
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,vid,state, start, end, name, level, New, age, fullLevel] = data[i];
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
    merged.push({start,end: blockEnd,name: (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name),level,fullLevel,id,vids,states});
    i = j;
  }
  let html="";
  for (let i = 0; i < merged.length; i++){
    const color = (merged[i].states[0]=="noshowed")?"#850000;":((merged[i].states[0]=="completed")?"#00833D;":"#007BB4;");
    html+=`<tr><td><div class="text" style=color:${color}>${merged[i].name}</div></td><td class="actions-cell checkins-cell"><div class="checkin-stack">`;
    for (let j = 0; j < merged[i].vids.length; j++){
      html+=`<button class="checkIn" data-role="checkin" style=background-color:${(merged[i].states[j]=="noshowed")?"#850000;":"#00833D;"} id="${merged[i].vids[j]}" data-state="${merged[i].states[j]}" onclick='if (this.textContent === "Check In") {this.textContent = "No Show";this.style.backgroundColor="#850000";} else {this.textContent = "Check In";this.style.backgroundColor="#00833D";}'>${(merged[i].states[j]=="noshowed")?"No Show":"Check In"}</button>`;
    };
    const noteData = JSON.stringify({id: merged[i].id, name: merged[i].name, fullLevel: merged[i].fullLevel}).replace(/"/g, '\\"');
    html+=`</div></td><td class="actions-cell notes-cell"><button class="checkIn notes-btn" data-role="note" style="background-color:#007BB4;" onclick='sessionStorage.setItem("noteContext", "${noteData}"); navigate("notes");' id="${merged[i].id}">Notes</button></td></tr>`;
  };
  console.log((merged.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  let attendance=[];
  [...document.getElementById("myTable").rows].forEach(row=>{
    attendance=attendance.concat(([...row.querySelectorAll("button[data-role='checkin']")].map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}))));
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
    for (const v of attendance.filter(v => (v.type == "Check In" ? "complete" : "noshow") != v.state && v.state != "registered")) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: "reset" } })
      });
    }
    // update state
    for (const v of attendance.filter(v => (v.type == "Check In" ? "complete" : "noshow") != v.state)) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: v.type == "Check In" ? "complete" : "noshow" } })
      });
    }
    // punch no-shows
    for (const v of attendance.filter(v => v.type == "No Show" && v.state != "noshow")) {
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
  [...document.getElementById("myTable").rows].forEach(row=>{
    attendance=attendance.concat(([...row.querySelectorAll("button[data-role='checkin']")].map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}))));
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
