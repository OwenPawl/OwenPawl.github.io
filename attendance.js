{
  // --- STATE MANAGEMENT ---
  const visitState = new Map();

  const handleAttendanceLoading = () => {
    const table = document.getElementById("myTable");
    if (table) {
      table.innerHTML = "";
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.innerHTML = "<b>Loading...</b>";
    }
  };

  const handleScheduleUpdate = (e) => {
    updateTable(e.detail);
  };

  const handleInteraction = (e) => {
    if (e.target.matches("input[data-role='checkin']")) {
      const vid = e.target.id;
      const isChecked = e.target.checked;
      
      if (visitState.has(vid)) {
        const record = visitState.get(vid);
        record.isChecked = isChecked;
        visitState.set(vid, record);
      }
    }
  };

  const dateInput = document.getElementById("dateInput");
  const table = document.getElementById("myTable");

  if (dateInput) dateInput.addEventListener("change", handleAttendanceLoading);
  if (table) table.addEventListener("change", handleInteraction);
  
  window.addEventListener("scheduleUpdated", handleScheduleUpdate);
  window.addEventListener("scheduleLoading", handleAttendanceLoading);

  window.cleanupView = () => {
    if (dateInput) dateInput.removeEventListener("change", handleAttendanceLoading);
    if (table) table.removeEventListener("change", handleInteraction);
    window.removeEventListener("scheduleUpdated", handleScheduleUpdate);
    window.removeEventListener("scheduleLoading", handleAttendanceLoading);
    visitState.clear();
  };

  // --- RENDER LOGIC ---
  function updateTable(schedule) {
    const table = document.getElementById("myTable");
    table.innerHTML = "";
    visitState.clear();

    const rawData = normalizeSchedule(schedule).filter(item => (!EXCLUDED_IDS.includes(item.id)));
    
    if (!rawData.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "No Events";
      cell.style.fontWeight = "bold";
      return;
    }

    const vidToTime = new Map();
    rawData.forEach(row => vidToTime.set(row.vid.toString(), row.start));
    
    const merged = mergeConsecutiveSlots(rawData);
    
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Name", "Showed", "Notes"].forEach((text, index) => {
      const th = document.createElement("th");
      th.textContent = text;
      if (index > 0) th.style.textAlign = "center";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    
    merged.forEach(item => {
      const tr = document.createElement("tr");

      // --- Name Cell ---
      const nameTd = document.createElement("td");
      const nameDiv = document.createElement("div");
      nameDiv.className = "text";
      
      const allCompleted = item.states.every(s => s === 'completed');
      const hasNoshow = item.states.some(s => s === 'noshowed');
      
      if (allCompleted) nameDiv.style.color = "#00833D"; 
      else if (hasNoshow) nameDiv.style.color = "#850000"; 
      else nameDiv.style.color = "#007BB4"; 

      if (item.isNew) {
        const badge = document.createElement("span");
        badge.className = "badge-new";
        badge.textContent = "NEW";
        nameDiv.appendChild(badge);
        nameDiv.appendChild(document.createTextNode(" "));
      }
      
      nameDiv.textContent += formatName(item);
      nameTd.appendChild(nameDiv);
      tr.appendChild(nameTd);

      // --- Checkins Cell ---
      const checkinsTd = document.createElement("td");
      checkinsTd.className = "actions-cell checkins-cell";
      const checkinStack = document.createElement("div");
      checkinStack.className = "checkin-stack";

      item.vids.forEach((vid, index) => {
        const state = item.states[index];
        const isChecked = (state !== 'late_canceled' && state !== 'noshowed');
        const eventTime = vidToTime.get(vid.toString());

        visitState.set(vid.toString(), {
          vid: vid.toString(),
          originalState: state,
          isChecked: isChecked,
          eventTime: eventTime
        });

        const label = document.createElement("label");
        label.className = "checkbox-wrapper";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "custom-checkbox";
        input.dataset.role = "checkin";
        input.id = vid;
        input.checked = isChecked;

        label.appendChild(input);
        checkinStack.appendChild(label);
      });
      checkinsTd.appendChild(checkinStack);
      tr.appendChild(checkinsTd);

      // --- Notes Cell ---
      const notesTd = document.createElement("td");
      notesTd.className = "actions-cell notes-cell";
      
      const notesBtn = document.createElement("button");
      notesBtn.className = "checkIn notes-btn";
      notesBtn.dataset.role = "note";
      notesBtn.ariaLabel = "Edit Notes";
      notesBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ffffff" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H80V72a8,8,0,0,0,16,0V56h64V72a8,8,0,0,0,16,0V56h40ZM96,120h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm64,32H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"></path></svg>`;
      
      notesBtn.onclick = () => {
        sessionStorage.setItem("noteContext", JSON.stringify({
          id: item.id,
          name: formatName(item),
          fullLevel: item.fullLevel,
          age: item.age
        }));
        navigate("notes");
      };

      notesTd.appendChild(notesBtn);
      tr.appendChild(notesTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  }

  updateTable(sessionStorage.getItem("schedule"));

  // --- SUBMIT LOGIC ---
  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const dateVal = document.getElementById("dateInput").value;
      const now = new Date();

      // 1. Check for empty schedule
      if (visitState.size === 0) {
        updateNotification("No events to submit.", "info", 3000);
        return;
      }

      // 2. Validate Time (Last event must be in the past)
      let latestEventTime = new Date(0); // Epoch
      let latestEventStr = "";

      for (const record of visitState.values()) {
        if (record.eventTime) {
          // Parse "9:00 AM" + dateVal into a Date object
          const timeStr = `${dateVal} ${record.eventTime}`;
          const evtDate = new Date(timeStr);
          if (!isNaN(evtDate) && evtDate > latestEventTime) {
            latestEventTime = evtDate;
            latestEventStr = record.eventTime;
          }
        }
      }

      // If the latest event hasn't started yet, block submission
      if (latestEventTime > now) {
        updateNotification(`Cannot submit future attendance (Last event: ${latestEventStr})`, "error", 4000);
        return;
      }

      // 3. Calculate Updates
      const updates = [];
      for (const record of visitState.values()) {
        const { vid, originalState, isChecked, eventTime } = record;
        
        let newState;
        if (isChecked) {
          newState = "complete";
        } else {
          if (originalState === "late_canceled") {
            newState = "late_canceled"; 
          } else {
            newState = "noshow";
          }
        }

        let needsUpdate = false;
        if (newState === "complete") {
          if (originalState !== "completed") needsUpdate = true;
        } else if (newState === "noshow") {
          if (originalState !== "noshowed") needsUpdate = true;
        }

        if (needsUpdate) {
          updates.push({ vid, newState, originalState, eventTime });
        }
      }

      // 4. Check for changes
      if (updates.length === 0) {
        updateNotification("No changes to submit.", "info", 3000);
        return;
      }

      // 5. Submit Process
      updateNotification("Submitting Attendance...", "info", 0); // 0 = Persistent

      const headers = {
        "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        "Content-Type": "application/json"
      };

      const rounds = {};
      updates.forEach(u => {
        const key = u.eventTime || "default";
        if (!rounds[key]) rounds[key] = [];
        rounds[key].push(u);
      });
      
      try {
        await Promise.all(Object.values(rounds).map(async (group) => {
            for (const u of group) {
              if (u.originalState !== 'registered') {
                await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({ visit: { state_event: "reset" } })
                }).catch(e => console.error(e));
              }
              
              await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ visit: { state_event: u.newState } })
              }).catch(e => console.error(e));

              if (u.newState === "noshow") {
                await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/punches`, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ punch: { visit_id: u.vid } })
                }).catch(e => console.error(e));
              }
              await new Promise(r => setTimeout(r, 500));
            }
        }));

        updateNotification("Attendance Submitted!", "success", 3000);
        await new Promise(r => setTimeout(r, 500));
        document.getElementById("dateInput").dispatchEvent(new Event("change"));
        
      } catch (e) {
        console.error(e);
        updateNotification("Error submitting attendance.", "error", 4000);
      }
    });
  }

  // --- DYNAMIC NOTIFICATION HELPER ---
  let notificationTimeout;

  function updateNotification(message, type = "info", duration = 3000) {
    let container = document.querySelector(".notification-container");
    // Ensure container exists
    if (!container) {
      container = document.createElement("div");
      container.className = "notification-container";
      document.body.appendChild(container);
    }

    // Try to find existing banner
    let notification = container.querySelector(".notification-banner");
    
    // If not found, create it using global helper or manually if needed
    // We'll create it manually here to ensure control over the instance
    if (!notification) {
      notification = document.createElement("div");
      notification.className = `notification-banner ${type}`;
      
      const messageEl = document.createElement("span");
      messageEl.className = "notification-message";
      
      const closeBtn = document.createElement("button");
      closeBtn.className = "notification-close";
      closeBtn.innerHTML = "&times;";
      closeBtn.onclick = () => {
        notification.remove();
        if (notificationTimeout) clearTimeout(notificationTimeout);
      };

      notification.appendChild(messageEl);
      notification.appendChild(closeBtn);
      container.appendChild(notification);
    } else {
      // Update existing
      notification.className = `notification-banner ${type}`;
    }

    // Update Text
    notification.querySelector(".notification-message").textContent = message;

    // Handle Timeout
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
    if (duration > 0) {
      notificationTimeout = setTimeout(() => {
        notification.style.animation = "fadeOut 0.3s ease-out forwards";
        notification.addEventListener("animationend", () => {
          notification.remove();
          if (container.children.length === 0) container.remove();
        }, { once: true });
      }, duration);
    }
  }

  const resetBtn = document.getElementById("reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      updateNotification("Resetting Attendance...", "info", 0);
      
      const vidsToReset = Array.from(visitState.keys());
      
      await Promise.allSettled(vidsToReset.map(vid => 
        fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${vid}`, {
          body: JSON.stringify({ "visit": { "state_event": "reset" } }),
          method: "PUT",
          headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}`, "Content-Type": "application/json" },
          redirect: "follow"
        })
      ));
      
      updateNotification("Attendance Reset!", "success", 3000);
      await new Promise(resolve => setTimeout(resolve, 500));
      document.getElementById("dateInput").dispatchEvent(new Event("change"));
    });
  }
}