{
  const getEl = (id, container) => {
    if (!container) container = document.getElementById("app");
    return container.querySelector(`#${id}`);
  };

  const handleTableLoading = () => {
    const container = document.getElementById("scheduleContainer");
    if (container) {
      container.innerHTML = "<div style='padding:20px; text-align:center;'><b>Loading...</b></div>";
    }
    const locHeader = document.getElementById("locationHeader");
    if (locHeader) locHeader.innerHTML = "";
  };

  const handleTableUpdate = (e) => {
    window.renderSchedule(document.getElementById("app"), e.detail);
  };

  const attachListeners = () => {
    if (!window.scheduleListenersAttached) {
        const dateInput = document.getElementById("dateInput");
        
        if (dateInput) {
            dateInput.removeEventListener("change", handleTableLoading); 
            dateInput.addEventListener("change", handleTableLoading);
        }
        
        window.removeEventListener("scheduleUpdated", handleTableUpdate);
        window.removeEventListener("scheduleLoading", handleTableLoading);
        
        window.addEventListener("scheduleUpdated", handleTableUpdate);
        window.addEventListener("scheduleLoading", handleTableLoading);
        
        window.scheduleListenersAttached = true;
    }
  };

  window.cleanupView = () => {
    const dateInput = document.getElementById("dateInput");
    if (dateInput) dateInput.removeEventListener("change", handleTableLoading);
    window.removeEventListener("scheduleUpdated", handleTableUpdate);
    window.removeEventListener("scheduleLoading", handleTableLoading);
    window.scheduleListenersAttached = false;
  };

  window.renderSchedule = (container, scheduleData = null) => {
    if (!container) container = document.getElementById("app");

    if (container.id === "app") {
        attachListeners();
    }

    let contentContainer = getEl("scheduleContainer", container);
    
    if (!contentContainer) {
      const table = getEl("myTable", container);
      if (table) {
        contentContainer = document.createElement("div");
        contentContainer.id = "scheduleContainer";
        contentContainer.className = "schedule-grid";
        table.parentNode.replaceChild(contentContainer, table);
      } else {
        return; 
      }
    }
    
    contentContainer.innerHTML = "";

    const dataRaw = scheduleData || sessionStorage.getItem("schedule");
    const data = normalizeSchedule(dataRaw);
    const locationsMap = JSON.parse(localStorage.getItem("locations_map") || "{}");
    
    const locHeader = getEl("locationHeader", container);
    if (locHeader) {
      locHeader.innerHTML = ""; 
      const validForLoc = data.filter(d => !EXCLUDED_IDS.includes(d.id));
      const uniqueLocIds = [...new Set(validForLoc.map(d => d.locationId).filter(Boolean))];
      
      if (uniqueLocIds.length > 0) {
        uniqueLocIds.forEach(locId => {
          const locData = locationsMap[locId];
          if (locData) {
            const badge = document.createElement("a");
            badge.className = "location-badge";
            badge.href = locData.mapUrl;
            badge.target = "_blank";
            badge.innerHTML = `<i class="ph-fill ph-map-pin"></i> ${locData.name}`;
            locHeader.appendChild(badge);
          }
        });
      }
    }

    if (!data.length) {
      contentContainer.innerHTML = "<div style='grid-column:1/-1; padding:20px; text-align:center; font-weight:bold;'>No Lessons For This Day</div>";
      return;
    }

    const mergedRaw = mergeConsecutiveSlots(data);
    
    const merged = mergedRaw.map(row => {
      const state = row.states[0]; 
      if (state == "late_canceled" || state == "canceled") {
        return { 
          ...row, 
          name: "CANCELED", 
          shortLevel: "\u3164", 
          age: "\u3164",
          isNew: false 
        };
      }
      return {
        ...row,
        name: formatName(row) 
      };
    });
    
    const groups = merged.reduce((acc, r) => {
      (acc[r.start] ??= []).push(r);
      return acc;
    }, {});
    
    const headers = ["Time", "Name", "Lvl", "Age"];
    headers.forEach(text => {
      const headerDiv = document.createElement("div");
      headerDiv.className = "header-cell";
      headerDiv.textContent = text;
      contentContainer.appendChild(headerDiv);
    });

    Object.entries(groups).forEach(([start, rows], groupIndex) => {
      const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
      const stripeClass = groupIndex % 2 === 0 ? "group-even" : "group-odd";

      rows.forEach((r, idx) => {
        if (idx === 0) {
          const timeDiv = document.createElement("div");
          timeDiv.className = `schedule-cell time-cell ${stripeClass}`;
          
          if (rows.length > 1) {
            timeDiv.style.gridRow = `span ${rows.length}`;
            timeDiv.style.alignSelf = "center"; 
          }

          const timeVal = document.createElement("div");
          timeVal.textContent = start.split(" ")[0];
          timeVal.style.fontWeight = "800";
          timeDiv.appendChild(timeVal);

          const durVal = document.createElement("div");
          durVal.className = "muted";
          durVal.style.fontSize = "0.85em";
          durVal.textContent = `+${duration}`;
          timeDiv.appendChild(durVal);
          
          contentContainer.appendChild(timeDiv);
        }

        const nameDiv = document.createElement("div");
        nameDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) nameDiv.classList.add("row-separator");
        
        const span = document.createElement("span");
        span.className = "name-text";
        if (r.isNew) {
            const badge = document.createElement("span");
            badge.className = "badge-new";
            badge.textContent = "NEW";
            span.appendChild(badge);
            span.appendChild(document.createTextNode(" "));
        }
        span.appendChild(document.createTextNode(r.name));
        nameDiv.appendChild(span);
        contentContainer.appendChild(nameDiv);

        const lvlDiv = document.createElement("div");
        lvlDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) lvlDiv.classList.add("row-separator");
        lvlDiv.textContent = r.shortLevel || "";
        contentContainer.appendChild(lvlDiv);

        const ageDiv = document.createElement("div");
        ageDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) ageDiv.classList.add("row-separator");
        ageDiv.textContent = r.age || "";
        contentContainer.appendChild(ageDiv);
      });
    });
  };
  
  window.renderSchedule(document.getElementById("app"));
}