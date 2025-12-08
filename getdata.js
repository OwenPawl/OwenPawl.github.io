document.getElementById("dateInput").addEventListener("change", (event) => {
  console.log("dateInput changed, value:", event.target.value)
  dateChanged(event.target.value);
});

window.addEventListener("staffIdReady", () => {
  const dateVal = document.getElementById("dateInput").value;
  if (dateVal) {
    dateChanged(dateVal);
  }
});

async function getevents() {
  const midnight = new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(11, 19);
  let result = [];
  let staff_id = localStorage.getItem("staff_id");
  let dateInputValue = document.getElementById("dateInput").value
  
  if (!staff_id) {
    console.log("Waiting for staff_id...");
    return; 
  }

  window.dispatchEvent(new Event("scheduleLoading"));

  try {
    const [events, opens] = await Promise.all([
      pikeFetch(`event_occurrences.json?&from=${dateInputValue}T${midnight}Z&staff_member_ids=${staff_id}`),
      pikeFetch(`available_times.json?&from=${dateInputValue}T${midnight}Z`)
    ]);

    const Events = events;
    const Opens = opens;

    const uniqueOpens = [];
    const seenOpenTimes = new Set();
    
    if (Opens && Opens.available_times) {
      Opens.available_times
        .filter(open => open.staff_member_id == staff_id)
        .forEach(open => {
           const key = open.start_at;
           if (!seenOpenTimes.has(key)) {
             seenOpenTimes.add(key);
             uniqueOpens.push(open);
           }
        });
    }

    result = [
      ...Events.event_occurrences.flatMap(event => event.people.map(person => {
        // --- CHANGE: Pre-check for excluded IDs ---
        const isExcluded = EXCLUDED_IDS.includes(person.id);
        return {
          id: person.id,
          vid: person.visit_id,
          state: person.visit_state,
          start: event.start_at,
          end: event.end_at,
          name: person.name,
          // Set to EMPTY string immediately if excluded, else "..."
          shortLevel: isExcluded ? "" : "...",
          isNew: "",
          age: isExcluded ? "" : "...",
          fullLevel: "",
          firstName: "",
          lastName: ""
        };
      })),
      ...uniqueOpens.map(({
        start_at,
        end_at,
        location_id
      }) => ({
        id: "",
        vid: location_id,
        state: "available",
        start: start_at,
        end: end_at,
        name: "Open",
        shortLevel: "",
        isNew: "",
        age: "",
        fullLevel: "",
        firstName: "",
        lastName: ""
      }))
    ];

    const uniquePersonIds = [...new Set(result
      .map(r => r.id)
      .filter(id => id && !EXCLUDED_IDS.includes(id))
    )];

    if (uniquePersonIds.length > 0) {
      const levelsPromise = pikeFetch(`people.json?ids=${uniquePersonIds.join(",")}`);

      const visitsPromises = uniquePersonIds.map(id => 
        pikeFetch(`people/${id}/visits/summary`)
          .then(data => ({ id, data }))
          .catch(e => ({ id, error: e }))
      );

      const [peopleData, ...visitsResults] = await Promise.all([levelsPromise, ...visitsPromises]);

      const peopleMap = new Map();
      if (peopleData && peopleData.people) {
        peopleData.people.forEach(p => {
          let age = "...";
          if (p.birthdate) {
            age = Math.floor((Date.now() - new Date(p.birthdate)) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;
          }
          peopleMap.set(p.id, {
            fullLevel: p.secondary_info_field || "",
            age: age,
            firstName: p.first_name || "",
            lastName: p.last_name || ""
          });
        });
      }

      const visitsMap = new Map();
      visitsResults.forEach(({ id, data }) => {
        let isNew = true; 
        
        if (data && data.summaries && data.summaries.length > 0) {
          const summary = data.summaries[0];
          if (summary.first_visited_at) {
             const firstVisitDate = summary.first_visited_at.split("T")[0];
             if (firstVisitDate < dateInputValue) {
               isNew = false;
             }
          }
        }
        visitsMap.set(id, isNew);
      });

      result = result.map(item => {
        if (!item.id || EXCLUDED_IDS.includes(item.id)) return item;

        const pData = peopleMap.get(item.id) || {};
        const isNew = visitsMap.get(item.id) ?? false;
        
        const shortLevel = getShortLevel(pData.fullLevel, pData.age);

        return {
          ...item,
          shortLevel,
          isNew,
          age: pData.age,
          fullLevel: pData.fullLevel,
          firstName: pData.firstName,
          lastName: pData.lastName
        };
      });
    }

    result = result.sort((a, b) => new Date(a.start) - new Date(b.start))
                   .map(item => ({
                     ...item,
                     start: new Intl.DateTimeFormat("en-US", {
                       timeZone: "America/Los_Angeles",
                       hour: "numeric",
                       minute: "2-digit",
                       hour12: true
                     }).format(new Date(item.start)),
                     end: new Intl.DateTimeFormat("en-US", {
                       timeZone: "America/Los_Angeles",
                       hour: "numeric",
                       minute: "2-digit",
                       hour12: true
                     }).format(new Date(item.end))
                   }));
    
    sessionStorage.setItem("schedule", JSON.stringify(result));
    window.dispatchEvent(new CustomEvent("scheduleUpdated", {
      detail: sessionStorage.getItem("schedule")
    }));

  } catch (error) {
    console.error("Error fetching or processing API data:", error);
    window.dispatchEvent(new CustomEvent("scheduleUpdated", { detail: "[]" }));
  }
  return result;
};

function dateChanged(date) {
  getevents().catch(console.error);
};

if (!document.getElementById("dateInput").value) {
  document.getElementById("dateInput").value = new Date().toLocaleDateString('en-CA');
  dateChanged(document.getElementById("dateInput").value);
};