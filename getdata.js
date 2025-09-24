document.getElementById("dateInput").addEventListener("change", (event) => {
  console.log("dateInput changed, value:", event.target.value)
  dateChanged(event.target.value);
});
async function getevents() {
  try {
      const requestOptions = {
        method: "GET",
        headers: {"Authorization": "Bearer kZEbOpElCispz8mFkeoTsVGVCvSP23mZG82G7eeN","Content-Type":"application/json"},
        redirect: "follow"
      };
    const response = await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/staff_members/${localStorage.getItem("staff_id")}/event_occurrences.json?&from=${document.getElementById("dateInput").value}T07:00:00Z`,requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
//new Intl.DateTimeFormat("en-US",{hour: "numeric",minute: "2-digit",hour12: true,timeZone: "America/Los_Angeles"}).format(new Date(event.start_at))
    const result = data.event_occurrences.flatMap(event =>
      event.people.map(person => [
        person.id,
        person.visit_id,
        person.visit_state,
        event.start_at,
        event.end_at,
        person.name
      ])
    );
  } catch (error) {
    console.error("Error fetching or processing data:", error);
  }
  try {
      const requestOptions = {
        method: "POST",
        headers: {"Authorization": "Bearer kZEbOpElCispz8mFkeoTsVGVCvSP23mZG82G7eeN","Content-Type":"application/json"},
        body: JSON.stringify({"data":{"type":"queries","attributes":{"page":{},"fields":["person_id","custom_field_180098","first_visit_date","birthdate"],"filter":${["or",result.map(item => ["eq", "person_id", [item[0].toString()]])]}}}),
        redirect: "follow"
      };
    const response = await fetch(`https://mcdonaldswimschool.pike13.com/desk/api/v3/reports/clients/queries`,requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const result = result.map(person=>person.concat((data.data?.attributes?.rows.map(item => {item[0]:[(item[1].match(/\d+/) || [item[1]])[0],(!item[2]),Math.floor((Date.now() - new Date(item[3]))*3.16881*10**-15) / 10])[person[0]]))
    );
  } catch (error) {
    console.error("Error fetching or processing data:", error);
  }
  return result;
  };
function dateChanged(date) {
  const requestOptions = {
    method: "POST",
    headers: {"Authorization": "Bearer kZEbOpElCispz8mFkeoTsVGVCvSP23mZG82G7eeN","Content-Type":"application/json"},
    body: JSON.stringify({"data":{"type":"queries","attributes":{"page":{"limit":500},"fields":["full_name","service_time","first_visit","state","service_location_name","person_id","visit_id"],"filter":["and",[["eq","service_date",[`${date}`]],["eq","instructor_names",[`${localStorage.getItem("staff_name")}`]]]],"sort":["service_time"]}}}),
    redirect: "follow"
  };
  
  fetch("https://mcdonaldswimschool.pike13.com/desk/api/v3/reports/enrollments/queries", requestOptions)
    .then(response => response.json())
    .then(result => {
      sessionStorage.setItem("events", JSON.stringify(result.data?.attributes?.rows  || []));
      console.log(JSON.stringify(result.data?.attributes?.rows.map(item => ["eq", "person_id", [item[5].toString()]])  || []));
    })
    .catch(error => console.error("Error:", error));
};
if (!document.getElementById("dateInput").value) {
  document.getElementById("dateInput").value=new Date().toISOString().split("T")[0];
  dateChanged(document.getElementById("dateInput").value);
};
