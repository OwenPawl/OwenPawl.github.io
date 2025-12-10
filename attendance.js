{
  const visitState = new Map();

  const getEl = (id, container) => {
    if (!container) container = document.getElementById("app");
    return container.querySelector(`#${id}`);
  };

  // PASSIVE LOADER: Background refresh (keep cached content)
  const handleAttendanceLoading = () => {
    const container = document.getElementById("attendanceContainer");
    if (container) {
      if (container.children.length === 0) {
        container.innerHTML = "<div style='grid-column:1/-1; padding:20px; text-align:center;'><b>Loading...</b></div>";
      }
    }
  };

  // ACTIVE LOADER: Date change (wipe and show loading)
  const handleDateChange = () => {
    const container = document.getElementById("attendanceContainer");
    if (container) {
      container.innerHTML = "<div style='grid-column:1/-1; padding:20px; text-align:center;'><b>Loading...</b></div>";
    }
  };

  const handleScheduleUpdate = (e) => {
    window.renderAttendance(document.getElementById("app"), e.detail);
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

  const attachListeners = () => {
    if (!window.attendanceListenersAttached) {
        const dateInput = document.getElementById("dateInput");
        const wrapper = document.querySelector(".table-wrapper"); 
        
        if (dateInput) {
            dateInput.removeEventListener("change", handleDateChange);
            dateInput.addEventListener("change", handleDateChange);
        }
        if (wrapper) {
            wrapper.removeEventListener("change", handleInteraction);
            wrapper.addEventListener("change", handleInteraction);
        }
        
        window.removeEventListener("scheduleUpdated", handleScheduleUpdate);
        window.removeEventListener("scheduleLoading", handleAttendanceLoading);
        
        window.addEventListener("scheduleUpdated", handleScheduleUpdate);
        window.addEventListener("scheduleLoading", handleAttendanceLoading);
        window.attendanceListenersAttached = true;
    }
  };

  window.cleanupView = () => {
    const dateInput = document.getElementById("dateInput");
    if (dateInput) dateInput.removeEventListener("change", handleDateChange);
    const wrapper = document.querySelector(".table-wrapper");
    if (wrapper) wrapper.removeEventListener("change", handleInteraction);
    
    window.removeEventListener("scheduleUpdated", handleScheduleUpdate);
    window.removeEventListener("scheduleLoading", handleAttendanceLoading);
    window.attendanceListenersAttached = false;
  };

  window.renderAttendance = (container, scheduleData = null) => {
    if (!container) container = document.getElementById("app");

    if (container.id === "app") {
        attachListeners();
    }

    let contentContainer = getEl("attendanceContainer", container);
    
    if (!contentContainer) {
      const table = getEl("myTable", container);
      if (table) {
        contentContainer = document.createElement("div");
        contentContainer.id = "attendanceContainer";
        contentContainer.className = "attendance-grid";
        table.parentNode.replaceChild(contentContainer, table);
      } else {
        return;
      }
    }
    
    contentContainer.innerHTML = "";
    
    if (container.id === "app") {
        visitState.clear();
    }

    const dataRaw = scheduleData || sessionStorage.getItem("schedule");
    const rawData = normalizeSchedule(dataRaw).filter(item => (!EXCLUDED_IDS.includes(item.id)));
    
    if (!rawData.length) {
      contentContainer.innerHTML = "<div style='grid-column:1/-1; padding:20px; text-align:center; font-weight:bold;'>No Events</div>";
      return;
    }

    const vidToTime = new Map();
    rawData.forEach(row => vidToTime.set(row.vid.toString(), row.start));
    
    const merged = mergeConsecutiveSlots(rawData);
    
    const groups = merged.reduce((acc, r) => {
      (acc[r.start] ??= []).push(r);
      return acc;
    }, {});

    const headers = ["Name", "Showed", "Notes"];
    headers.forEach((text, index) => {
      const headerDiv = document.createElement("div");
      headerDiv.className = "att-header-cell";
      if (index > 0) headerDiv.classList.add("center");
      headerDiv.textContent = text;
      contentContainer.appendChild(headerDiv);
    });

    Object.values(groups).forEach((groupRows, groupIndex) => {
      const stripeClass = groupIndex % 2 === 0 ? "group-even" : "group-odd";

      groupRows.forEach(item => {
        const nameDiv = document.createElement("div");
        nameDiv.className = `att-cell name-cell ${stripeClass}`;
        const nameTextDiv = document.createElement("div");
        nameTextDiv.className = "text";
        
        const allCompleted = item.states.every(s => s === 'completed');
        const hasNoshow = item.states.some(s => s === 'noshowed');
        
        if (allCompleted) nameTextDiv.style.color = "#00833D"; 
        else if (hasNoshow) nameTextDiv.style.color = "#850000"; 
        else nameTextDiv.style.color = "#007BB4"; 

        if (item.isNew) {
          const badge = document.createElement("span");
          badge.className = "badge-new";
          badge.textContent = "NEW";
          nameTextDiv.appendChild(badge);
          nameTextDiv.appendChild(document.createTextNode(" "));
        }
        
        nameTextDiv.appendChild(document.createTextNode(formatName(item)));
        nameDiv.appendChild(nameTextDiv);
        contentContainer.appendChild(nameDiv);

        const checkinsDiv = document.createElement("div");
        checkinsDiv.className = `att-cell checkins-cell ${stripeClass}`;
        const checkinStack = document.createElement("div");
        checkinStack.className = "checkin-stack";

        item.vids.forEach((vid, index) => {
          const state = item.states[index];
          const isChecked = (state !== 'late_canceled' && state !== 'noshowed');
          const eventTime = vidToTime.get(vid.toString());

          if (container.id === "app") {
            visitState.set(vid.toString(), {
              vid: vid.toString(),
              originalState: state,
              isChecked: isChecked,
              eventTime: eventTime
            });
          }

          const label = document.createElement("label");
          label.className = "checkbox-wrapper";

          const input = document.createElement("input");
          input.type = "checkbox";
          input.className = "custom-checkbox";
          input.dataset.role = "checkin";
          input.id = vid;
          input.checked = isChecked;
          
          if (container.id !== "app") input.disabled = true;

          label.appendChild(input);
          checkinStack.appendChild(label);
        });
        checkinsDiv.appendChild(checkinStack);
        contentContainer.appendChild(checkinsDiv);

        const notesDiv = document.createElement("div");
        notesDiv.className = `att-cell notes-cell ${stripeClass}`;
        const notesBtn = document.createElement("button");
        notesBtn.className = "checkIn notes-btn";
        notesBtn.dataset.role = "note";
        notesBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ffffff" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H80V72a8,8,0,0,0,16,0V56h64V72a8,8,0,0,0,16,0V56h40ZM96,120h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm64,32H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"></path></svg>`;
        
        if (container.id === "app") {
            notesBtn.onclick = () => {
              sessionStorage.setItem("noteContext", JSON.stringify({
                id: item.id,
                name: formatName(item),
                fullLevel: item.fullLevel,
                age: item.age
              }));
              window.navigate("notes");
            };
        }
        notesDiv.appendChild(notesBtn);
        contentContainer.appendChild(notesDiv);
      });
    });
    
    if (container.id === "app") {
        attachSubmitLogic();
    }
  };

  function attachSubmitLogic() {
      const submitBtn = document.getElementById("submit");
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const dateVal = document.getElementById("dateInput").value;
          const now = new Date();

          if (visitState.size === 0) {
            updateNotification("No events to submit.", "info", 3000);
            return;
          }

          let latestEventTime = new Date(0);
          let latestEventStr = "";

          for (const record of visitState.values()) {
            if (record.eventTime) {
              const timeStr = `${dateVal} ${record.eventTime}`;
              const evtDate = new Date(timeStr);
              if (!isNaN(evtDate) && evtDate > latestEventTime) {
                latestEventTime = evtDate;
                latestEventStr = record.eventTime;
              }
            }
          }

          if (latestEventTime > now) {
            updateNotification(`Cannot submit future attendance (Last event: ${latestEventStr})`, "error", 4000);
            return;
          }

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

          if (updates.length === 0) {
            updateNotification("No changes to submit.", "info", 3000);
            return;
          }

          updateNotification("Submitting Attendance...", "info", 0);

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
        };
      }
      
      const resetBtn = document.getElementById("reset");
      if (resetBtn) {
        resetBtn.onclick = async () => {
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
        };
      }
  }

  let notificationTimeout;
  function updateNotification(message, type = "info", duration = 3000) {
    let container = document.querySelector(".notification-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "notification-container";
      document.body.appendChild(container);
    }
    let notification = container.querySelector(".notification-banner");
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
      notification.className = `notification-banner ${type}`;
    }
    notification.querySelector(".notification-message").textContent = message;
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
}