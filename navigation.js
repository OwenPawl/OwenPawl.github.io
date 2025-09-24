// Load a page into the content div and hide navigation
function load(file) {
    fetch(file)
    .then(response => {
      if (!response.ok) throw new Error("Page not found: " + file);
      return response.text();
    })
    .then(html => {
      document.body.innerHTML = html;
      if (file != "navigation.html") {
        const homeBtn = document.createElement("button");
        homeBtn.textContent = "Go Back";
        homeBtn.addEventListener("click", () => load("navigation.html"));
        document.body.prepend(homeBtn);
      }
    })
    .catch(err => console.error(err));
}
