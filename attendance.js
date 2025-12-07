document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  console.log("Attendance scheduleUpdated event received", e.detail);
  updateTable(e.detail);
});

function updateTable(schedule){
  const data = normalizeSchedule(schedule)
    .filter(item => (![11485475,11559838,13602611,13167161,""].includes(item[0])));
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
    merged.push({start,end: blockEnd,name: (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name),level,fullLevel,id,vids,states,isNew: New});
    i = j;
  }
  let html="<thead><tr><th>Name</th><th style='text-align:center;'>Showed</th><th style='text-align:right;'>Notes</th></tr></thead><tbody>";
  for (let i = 0; i < merged.length; i++){
    let color;
    const allCompleted = merged[i].states.every(s => s === 'completed');
    const hasNoshow = merged[i].states.some(s => s === 'noshowed');

    if (allCompleted) {
        color = "#00833D;"; // Green
    } else if (hasNoshow) {
        color = "#850000;"; // Red
    } else {
        color = "#007BB4;"; // Blue
    }

    const newBadge = merged[i].isNew ? '<span class="badge-new">NEW</span>' : '';
    html+=`<tr><td><div class="text" style=color:${color}>${merged[i].name} ${newBadge}</div></td><td class="actions-cell checkins-cell"><div class="checkin-stack">`;
    for (let j = 0; j < merged[i].vids.length; j++){
      const state = merged[i].states[j];
      const isChecked = (state !== 'late_canceled' && state !== 'noshowed');
      html+=`<label class="checkbox-wrapper"><input type="checkbox" class="custom-checkbox" data-role="checkin" id="${merged[i].vids[j]}" data-state="${state}" data-event-index="${j}" ${isChecked ? "checked" : ""}></label>`;
    };
    const noteData = JSON.stringify({id: merged[i].id, name: merged[i].name, fullLevel: merged[i].fullLevel}).replace(/"/g, '\\"').replace(/'/g, "&apos;");
    html+=`</div></td><td class="actions-cell notes-cell"><button class="checkIn notes-btn" data-role="note" style="background-color:#007BB4;" onclick='sessionStorage.setItem("noteContext", "${noteData}"); navigate("notes");' id="${merged[i].id}">Notes</button></td></tr>`;
  };
  html += "</tbody>";
  // Store student list for navigation
  sessionStorage.setItem("studentList", JSON.stringify(merged.map(m => ({id: m.id, name: m.name, fullLevel: m.fullLevel}))));
  console.log((merged.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Attendance() {
  if (new Date() >= new Date(document.getElementById("dateInput").value)) {
    // Corrected Logic: Collect data BEFORE clearing table
    let attendance = [];
    [...document.getElementById("myTable").rows].forEach(row => {
        const checkboxes = row.querySelectorAll("input[data-role='checkin']");
        checkboxes.forEach(cb => {
            attendance.push({
                vid: cb.id,
                currentState: cb.getAttribute("data-state"),
                isChecked: cb.checked,
                eventIndex: parseInt(cb.getAttribute("data-event-index"))
            });
        });
    });

    document.getElementById("myTable").innerHTML = "<tr><th>Attendance Submitted!</th></tr>";

    const headers = {
      "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
      "Content-Type": "application/json"
    };

    // Calculate needed updates
    const updates = attendance.map(item => {
        let newState;
        if (item.isChecked) {
            newState = "complete";
        } else {
            // Unchecked
            if (item.currentState === "late_canceled") {
                newState = "late_canceled"; // Preserve
            } else {
                newState = "noshow";
            }
        }

        let needsUpdate = false;

        if (newState === "complete") {
             if (item.currentState !== "completed") needsUpdate = true;
        } else if (newState === "noshow") {
             if (item.currentState !== "noshowed") needsUpdate = true;
        } else if (newState === "late_canceled") {
             needsUpdate = false;
        }

        return { ...item, newState, needsUpdate };
    }).filter(item => item.needsUpdate);

    // Group by event index for rounds
    const rounds = {};
    updates.forEach(u => {
        if (!rounds[u.eventIndex]) rounds[u.eventIndex] = [];
        rounds[u.eventIndex].push(u);
    });

    // Execute in rounds
    const maxIndex = Math.max(...updates.map(u => u.eventIndex), -1);

    for (let i = 0; i <= maxIndex; i++) {
        if (rounds[i]) {
            await Promise.all(rounds[i].map(async (u) => {
                 // Determine if reset is needed
                 // "If the state is completed and is being changed to noshow, then their attendance needs to be reset... same is true when going from no show to completed."
                 const isCompletedToNoshow = (u.currentState === 'completed' && u.newState === 'noshow');
                 const isNoshowToCompleted = (u.currentState === 'noshowed' && u.newState === 'complete');

                 if (isCompletedToNoshow || isNoshowToCompleted) {
                     await fetch(`${desk}visits/${u.vid}`, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({ visit: { state_event: "reset" } })
                     });
                 }

                 await fetch(`${desk}visits/${u.vid}`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify({ visit: { state_event: u.newState } })
                  });
                 if (u.newState === "noshow") {
                     await fetch(`${desk}punches`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ punch: { visit_id: u.vid } })
                      });
                 }
            }));
        }
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
    // Corrected Reset logic
    let attendance=[];
    [...document.getElementById("myTable").rows].forEach(row=>{
        const checkboxes = row.querySelectorAll("input[data-role='checkin']");
        checkboxes.forEach(cb => {
            attendance.push({vid: cb.id});
        });
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
