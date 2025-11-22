function load(file, scriptFile) {
  fetch(file)
    .then(r => r.text())
    .then(html => {
      document.getElementById("app").innerHTML = html;

      if (typeof placeDateControls === "function") {
        placeDateControls();
      }

      if (scriptFile) {
        const script = document.createElement("script");
        script.src = scriptFile;
        script.defer = true;
        document.body.appendChild(script);
      }
    });
}
load("navigation.html","getdata.js");
