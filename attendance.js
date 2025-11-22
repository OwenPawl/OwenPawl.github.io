const TABLE_HEADER = "<thead><tr><th>Student</th><th>Check-Ins</th><th>Notes</th></tr></thead>";

function renderMessageRow(message) {
  document.getElementById("myTable").innerHTML = `${TABLE_HEADER}<tbody><tr><th colspan=\"3\">${message}</th></tr></tbody>`;
}

document.getElementById("dateInput").addEventListener("change", (event) => {
  renderMessageRow("Loading...");
  updateAttendanceDateBadge();
});
window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function updateAttendanceDateBadge() {
  const badge = document.getElementById("attendanceDateBadge");
  if (!badge) return;

  const value = document.getElementById("dateInput")?.value;
  if (!value) {
    badge.textContent = "Select a date";
    return;
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
  badge.textContent = formatted;
}

function toggleCheckIn(button) {
  const shouldNoShow = button.textContent === "Check In";
  button.textContent = shouldNoShow ? "No Show" : "Check In";
  button.style.backgroundColor = shouldNoShow ? "#850000" : "#00833D";
  button.dataset.state = shouldNoShow ? "noshow" : "complete";
}

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
  updateAttendanceDateBadge();
  const data = normalizeSchedule(schedule)
    .filter(item => (item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,""].includes(item[0])))
    .map(i => i.slice(0,7));
  if (!data.length) {
    renderMessageRow("No Events");
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
  let html="";
  for (let i = 0; i < merged.length; i++){
    const normalizedStates = merged[i].states.map(state => state === "noshowed" ? "noshow" : state === "completed" ? "complete" : state);
    const checkins = merged[i].vids.map((visitId, idx) => {
      const state = normalizedStates[idx];
      const isNoShow = state === "noshow";
      return `<button class="checkIn" style=\"background-color:${isNoShow ? "#850000" : "#00833D"};\" id=\"${visitId}\" data-state=\"${state}\" onclick=\"toggleCheckIn(this)\">${isNoShow ? "No Show" : "Check In"}</button>`;
    }).join("");

    const hasNoShow = normalizedStates.some(state => state === "noshow");
    const studentColor = hasNoShow ? "#850000;" : "#007BB4;";
    html += `<tr>
      <td>
        <div class="text" style=\"color:${studentColor}\">${merged[i].name}</div>
        ${merged[i].vids.length > 1 ? `<div class="muted lesson-meta">${merged[i].vids.length} lessons in a row</div>` : ""}
      </td>
      <td class="checkin-cell">${checkins}</td>
      <td class="notes-cell"><button class="checkIn" style=\"background-color:#007BB4;\" onclick=\"location.href='https://mcdonaldswimschool.pike13.com/people/${merged[i].id}/notes';\" id=\"${merged[i].id}\">Notes</button></td>
    </tr>`;
  };
  const tableMarkup = `${TABLE_HEADER}<tbody>${html}</tbody>`;
  document.getElementById("myTable").innerHTML = (merged.length>0)?tableMarkup:`${TABLE_HEADER}<tbody><tr><th colspan=\"3\">No Events</th></tr></tbody>`;
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  const attendance=[...document.querySelectorAll("#myTable .checkIn")]
    .filter(btn => btn.closest(".checkin-cell"))
    .map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}));
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Attendance() {
  if (new Date() >= new Date(document.getElementById("dateInput").value)) {
    renderMessageRow("Attendance Submitted!");
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
    renderMessageRow("All Events Must Be In the Past");
    await new Promise(r => setTimeout(r, 2000));
    updateTable();
  }
}
  Attendance();
});
document.getElementById("reset").addEventListener("click", (event) => {
  const attendance=[...document.querySelectorAll("#myTable .checkIn")]
    .filter(btn => btn.closest(".checkin-cell"))
    .map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}));
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Reset(){
    renderMessageRow("Attendance Reset!");
    await Promise.allSettled(attendance.map(visit=>fetch(desk+`visits/${visit.vid}`,{body:JSON.stringify({"visit":{"state_event":"reset"}}),method:"PUT",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await new Promise(resolve => setTimeout(resolve, 500));
    document.getElementById("dateInput").dispatchEvent(new Event("change"));
  };
  Reset();
});
