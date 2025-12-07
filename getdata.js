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

  console.log(staff_id);
  console.log(dateInputValue);

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
      ...Events.event_occurrences.flatMap(event => event.people.map(person => ({
        id: person.id,
        vid: person.visit_id,
        state: person.visit_state,
        start: event.start_at, // Keep as ISO string for sorting/logic
        end: event.end_at,     // Keep as ISO string
        name: person.name,
        shortLevel: "...",
        isNew: "",
        age: "...",
        fullLevel: ""
      }))),
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
        fullLevel: ""
      }))
    ];

    // --- OPTIMIZATION: REMOVED FIRST SORT & FORMAT ---
    // We now keep the 'start' as an ISO string until the very end.
    // This removes the need for `_sortStart` and double sorting.
    
  } catch (error) {
    console.error("Error fetching or processing first API data:", error);
    window.dispatchEvent(new CustomEvent("scheduleUpdated", { detail: "[]" }));
    return []; 
  }

  // Second Pass: Fetch Details
  try {
    const reportsToken = await getReportsToken();
    
    if (!reportsToken) {
      throw new Error("Unable to obtain Reports API Token");
    }

    const reportUrl = `${PIKE13_API_V3}reports/clients/queries`;
    
    const personIds = result.filter(item => item.id).map(item => ["eq", "person_id", [item.id.toString()]]);
    
    if (personIds.length > 0) {
      const response = await fetch(reportUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${reportsToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            data: {
              type: "queries",
              attributes: {
                page: {},
                fields: ["person_id", "custom_field_180098", "first_visit_date", "birthdate"],
                filter: ["or", personIds]
              }
            }
          })
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();

      result = result.map(personObj => {
        const row = (data.data?.attributes?.rows || []).find(r => r[0] === personObj.id);
        
        if (!row || EXCLUDED_IDS.includes(personObj.id)) {
          return { ...personObj };
        }

        const ageYears = Math.floor((Date.now() - new Date(row[3])) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;
        const isNew = !row[2] || row[2] === dateInputValue;
        const fullLevel = row[1] || "";

        const shortLevel = getShortLevel(fullLevel, ageYears);

        return {
          ...personObj,
          shortLevel,
          isNew,
          age: ageYears,
          fullLevel
        };
      });
    }
    
    // --- SINGLE FINAL SORT & FORMAT ---
    result = result.sort((a, b) => new Date(a.start) - new Date(b.start))
                   .map(item => ({
                     ...item,
                     // We format specifically for display now
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
    console.error("Error fetching or processing second API data:", error);
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