document.getElementById("dateInput").addEventListener("change", (event) => {
  console.log("dateInput changed, value:", event.target.value)
  dateChanged(event.target.value);
});
async function getevents() {
  const midnight=new Date(new Date().setHours(0,0,0,0)).toISOString().slice(11,19);
  let result = [];
  let staff_id=localStorage.getItem("staff_id");
  let dateInputValue = document.getElementById("dateInput").value
  console.log(staff_id);
  console.log(dateInputValue);
  try {
    const requestOptions = {method: "GET",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"};
    const [events,opens] = await Promise.all([
        fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/event_occurrences.json?&from=${dateInputValue}T${midnight}Z&staff_member_ids=${staff_id}`,requestOptions),
        fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/available_times.json?&from=${dateInputValue}T${midnight}Z`,requestOptions)
    ]);

    const Events = await events.json();
    const Opens = await opens.json();

    // flatten people into result array
    result = [...Events.event_occurrences.flatMap(event =>event.people.map(person => [person.id,person.visit_id,person.visit_state,event.start_at,event.end_at,person.name,"...","","..."])),...Opens.available_times.filter(open => open.staff_member_id == staff_id).map(({ start_at, end_at, location_id })=>["", location_id, "available", start_at, end_at, "Open", "", "", ""])];
    result = result.sort((a, b) => new Date(a[3]) - new Date(b[3])).map(item=>[...item.slice(0,3),...item.slice(3,5).map(date=>new Intl.DateTimeFormat("en-US", {timeZone: "America/Los_Angeles",hour: "numeric",minute: "2-digit",hour12: true}).format(new Date(date))),...item.slice(5,9)]);
    sessionStorage.setItem("schedule", JSON.stringify(result));
    window.dispatchEvent(new CustomEvent("scheduleUpdated", { detail: sessionStorage.getItem("schedule")}));
    console.log(result);
  } catch (error) {
    console.error("Error fetching or processing first API data:", error);
    return []; // bail out
  }

  try {
    const response = await fetch(
      `https://mcdonaldswimschool.pike13.com/desk/api/v3/reports/clients/queries`,
      {method:"POST",headers: {"Authorization": "Bearer kZEbOpElCispz8mFkeoTsVGVCvSP23mZG82G7eeN","Content-Type": "application/json"},redirect: "follow",body:JSON.stringify({ data: { type: "queries", attributes: {page:{},fields:["person_id","custom_field_180098","first_visit_date","birthdate"], filter: ["or",result.filter(item=>item[0]).map(item =>["eq","person_id",[item[0].toString()]])]}}})}
    );
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    result = result.map(personRow => {
      const row = (data.data?.attributes?.rows || []).find(r => r[0] === personRow[0]);
      if (!row) return personRow;
      const ageYears = Math.floor((Date.now() - new Date(row[3])) / (1000 * 60 * 60 * 24 * 365)*10)/10;
      const isNew = !row[2] || row[2] === dateInputValue;
      if ([11485475,11559838,13602611,13167161].includes(personRow[0])) {
        return [...personRow.slice(0, 6),,,]
      } else {
        return [...personRow.slice(0, 6), /\d/.test(row[1][6])?row[1][6]:row[1].split(" ")[0][0], isNew, ageYears, row[1]];
      };
    });
    result = result.sort((a, b) => new Date(a[3]) - new Date(b[3])).map(item=>[...item.slice(0,3),...item.slice(3,5).map(date=>new Intl.DateTimeFormat("en-US", {timeZone: "America/Los_Angeles",hour: "numeric",minute: "2-digit",hour12: true}).format(new Date(date))),...item.slice(5)]);
  } catch (error) {
    console.error("Error fetching or processing second API data:", error);
  }
  return result;
};
function dateChanged(date) {
  getevents()
    .then(result => {
      sessionStorage.setItem("schedule", JSON.stringify(result));
      window.dispatchEvent(new CustomEvent("scheduleUpdated", { detail: result }));
    })
    .catch(console.error);
};
if (!document.getElementById("dateInput").value) {
  document.getElementById("dateInput").value=new Date().toLocaleDateString('en-CA');
  dateChanged(document.getElementById("dateInput").value);
};
