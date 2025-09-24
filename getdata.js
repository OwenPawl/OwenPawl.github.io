const requestOptions = {
  method: "POST",
  headers: {"Authorization": "Bearer kZEbOpElCispz8mFkeoTsVGVCvSP23mZG82G7eeN","Content-Type":"application/json},
  body: {"data":{"type":"queries","attributes":{"page":{"limit":500},"fields":["full_name","service_time","first_visit","state","service_location_name","person_id","visit_id"],"filter":["and",[["eq","service_date",["2025-09-27"]],["eq","instructor_names",["Owen Pawling"]]]],"sort":["service_time"]}}},
  redirect: "follow"
};

fetch("https://mcdonaldswimschool.pike13.com/desk/api/v3/reports/enrollments/queries", requestOptions)
  .then(response => response.json())
  .then(result => {
    // Extract the id from the first account
    sessionStorage.setItem("events", result.data?.attributes?.rows?);
  })
  .catch(error => console.error("Error:", error));
