// Load a page into the content div and hide navigation
function loadPage(pageUrl) {
  const nav = document.getElementById("nav");
  const content = document.getElementById("content");

  // Hide navigation
  nav.style.display = "none";

  // Fetch and insert new HTML content
  fetch(pageUrl)
    .then(response => {
      if (!response.ok) throw new Error("Network error");
      return response.text();
    })
    .then(html => {
      content.innerHTML = html;

      // Optionally add a "Back" button to the loaded content
      const backButton = document.createElement("button");
      backButton.textContent = "Back to Menu";
      backButton.onclick = goBack;
      backButton.style.marginTop = "10px";
      content.appendChild(backButton);
    })
    .catch(err => console.error("Failed to load page:", err));
}

// Clears content and shows navigation again
function goBack() {
  const nav = document.getElementById("nav");
  const content = document.getElementById("content");

  // Clear content
  content.innerHTML = "";

  // Show navigation
  nav.style.display = "block";
}
