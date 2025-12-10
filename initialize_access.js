if (!localStorage.getItem("access_token") && !window.location.hash.includes("access_token")) {
  window.location.href = `https://pike13.com/oauth/authorize?client_id=ixG6UsN5JaLPYFgwjhTAtmdg8UNU7IZYK2lOxTo3&response_type=token&redirect_uri=${window.location.href}`;
  };

if (window.location.hash.includes("access_token")) {
  localStorage.setItem("access_token", window.location.hash.slice(14,54));
  // Clean the hash so the router doesn't get confused by the token
  history.replaceState(null, null, ' ');
};

const staffId = localStorage.getItem("staff_id");

// Helper to trigger the ready event
const triggerStaffReady = () => {
  window.dispatchEvent(new Event("staffIdReady"));
};

if (!staffId) {
  const requestOptions = {
    method: "GET",
    headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`},
    redirect: "follow"
  };
  
  fetch("https://mcdonaldswimschool.pike13.com/api/v2/desk/staff_members/me", requestOptions)
    .then(response => response.json())
    .then(result => {
      // Extract the id from the first account
      if (result.staff_members?.[0]?.id) {
        localStorage.setItem("staff_id", result.staff_members[0].id);
        triggerStaffReady(); // Notify getdata.js that we are ready
      }
    })
    .catch(error => console.error("Error:", error));
} else {
  // If we already have it, trigger immediately (deferred scripts will catch this or check storage)
  // Since this script isn't deferred in index.html, we might be too early for listeners.
  // We don't need to do anything here; getdata.js checks storage on load.
}

// --- LOCATION INIT ---
// Fetch and store location data for map links
if (localStorage.getItem("access_token")) {
  fetch("https://mcdonaldswimschool.pike13.com/api/v2/desk/locations", {
    method: "GET",
    headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
    redirect: "follow"
  })
  .then(r => r.json())
  .then(data => {
    if (data.locations) {
      const locMap = {};
      data.locations.forEach(loc => {
        locMap[loc.id] = {
          name: loc.name,
          mapUrl: `https://maps.apple.com/?q=${encodeURIComponent(loc.address)}`
        };
      });
      localStorage.setItem("locations_map", JSON.stringify(locMap));
    }
  })
  .catch(e => console.error("Failed to init locations:", e));
}

// --- SECURITY INIT ---
if (typeof getReportsToken === 'function') {
    getReportsToken().catch(e => console.error("Failed to init reports token:", e));
} else {
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof getReportsToken === 'function') {
            getReportsToken();
        }
    });
}