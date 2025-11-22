if (!localStorage.getItem("access_token") && !window.location.hash.includes("access_token")) {
  window.location.href = `https://pike13.com/oauth/authorize?client_id=ixG6UsN5JaLPYFgwjhTAtmdg8UNU7IZYK2lOxTo3&response_type=token&redirect_uri=${window.location.href}`;
  };
if (window.location.hash.includes("access_token")) {
  localStorage.setItem("access_token", window.location.hash.slice(14,54));
};
if (!localStorage.getItem("staff_id")) {
  const requestOptions = {
    method: "GET",
    headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`},
    redirect: "follow"
  };
  
  fetch("https://mcdonaldswimschool.pike13.com/api/v2/desk/staff_members/me", requestOptions)
    .then(response => response.json())
    .then(result => {
      // Extract the id from the first account
      localStorage.setItem("staff_id", result.staff_members?.[0]?.id);
    })
    .catch(error => console.error("Error:", error));
};
