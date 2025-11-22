const dateInput = document.getElementById("dateInput");
document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
  updateDateBadge();
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

function normalizeState(state) {
  if (!state) return "registered";
  const lower = String(state).toLowerCase();
  if (lower.includes("noshow")) return "noshow";
  if (lower.includes("complete")) return "complete";
  return lower;
}

function updateDateBadge() {
  const badge = document.getElementById("dateBadge");
  if (!badge || !dateInput) return;
  const selected = dateInput.value || new Date().toLocaleDateString("en-CA");
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(selected));
  badge.textContent = formatted;
}

function updateTable(schedule){
  updateDateBadge();
  const data = normalizeSchedule(schedule)
    .filter(item => (item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,""].includes(item[0])))
    .map(i => i.slice(0,7));
  if (!data.length) {
    document.getElementById("myTable").innerHTML = "<tr><th>No Events</th></tr>";
    return;
  }
  const merged = [];
  const formatName = (s => {
    const parts = s.trim().split(/\s+/);
    const tokens = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
    return tokens
      .map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1)))
      .join(" ");
  });
  for (let i = 0; i < data.length; ) {
    const [id, vid, state, start, end, name, level] = data[i];
    let blockEnd = end;
    let vids = [vid];
    let states = [normalizeState(state)];
    let j = i + 1;
    while (
      j < data.length &&
      data[j][0] === id &&
      data[j][3] === blockEnd // next start matches previous end
    ) {
      blockEnd = data[j][4];
      vids.push(data[j][1]);
      states.push(normalizeState(data[j][2]));
      j++;
    }
    merged.push({ name: formatName(name), level, id, vids, states });
    i = j;
  }
  let html="";
  for (let i = 0; i < merged.length; i++){
    const suffix = merged[i].vids.length > 1;
    const checkButtons = merged[i].vids.map((vid, idx) => {
      const originalState = merged[i].states[idx];
      const desiredState = originalState === "noshow" ? "noshow" : "complete";
      const labelSuffix = suffix ? ` ${idx + 1}` : "";
      const isNoShow = desiredState === "noshow";
      const buttonLabel = `${isNoShow ? "No Show" : "Check In"}${labelSuffix}`;
      const tone = isNoShow ? "#850000" : "#00833D";
      return `<button class="checkIn" data-original-state="${originalState}" data-desired="${desiredState}" data-suffix="${labelSuffix}" style="background-color:${tone};" id="${vid}" aria-label="${buttonLabel}">${buttonLabel}</button>`;
    }).join("");
    html+=`<tr><td class="name-cell"><div class="text">${merged[i].name}</div>${merged[i].level ? `<div class="muted">${merged[i].level}</div>` : ""}</td><td><div class="check-stack">${checkButtons}</div></td><td class="notes-cell"><button class="checkIn" style="background-color:#007BB4;" onclick="location.href='https://mcdonaldswimschool.pike13.com/people/${merged[i].id}/notes';" id="${merged[i].id}">Notes</button></td></tr>`;
  };
  const markup = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
  document.getElementById("myTable").innerHTML = markup;
  document.querySelectorAll(".checkIn[data-desired]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.desired === "noshow" ? "complete" : "noshow";
      const labelSuffix = btn.dataset.suffix || "";
      btn.dataset.desired = next;
      btn.style.backgroundColor = next === "noshow" ? "#850000" : "#00833D";
      btn.textContent = `${next === "noshow" ? "No Show" : "Check In"}${labelSuffix || ""}`;
    });
  });
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  let attendance=[];
  [...document.getElementById("myTable").rows].forEach(row=>{
    attendance = attendance.concat(([...row.querySelectorAll(".checkIn[data-desired]")].map(btn=>({
      vid: btn.id,
      original: normalizeState(btn.getAttribute("data-original-state")),
      desired: normalizeState(btn.getAttribute("data-desired"))
    }))));
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
    const stateEvent = (state) => state === "noshow" ? "noshow" : "complete";
    const needsReset = attendance.filter(v => v.original !== v.desired && v.original !== "registered");
    for (const v of needsReset) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: "reset" } })
      });
    }
    // update state
    for (const v of attendance.filter(v => v.original !== v.desired)) {
      await fetch(`${desk}visits/${v.vid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ visit: { state_event: stateEvent(v.desired) } })
      });
    }
    // punch no-shows
    for (const v of attendance.filter(v => v.desired === "noshow" && v.original !== "noshow")) {
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
    attendance = attendance.concat(([...row.querySelectorAll(".checkIn[data-desired]")].map(btn=>({
      vid: btn.id,
      original: normalizeState(btn.getAttribute("data-original-state"))
    }))));
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
