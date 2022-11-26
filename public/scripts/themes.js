const themes = () => {
  let themeBtn = document.getElementById("modecheck");
  let userPreferedScheme = window.matchMedia("(prefers-color-scheme:dark)");
  let currentTheme = localStorage.getItem("theme");

  if (currentTheme == "dark") {
    document.body.classList.toggle("dark-theme");
    document.getElementById("navlogo").src =
      "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437395/Images/light-logo_kugpz0.png";
  } else if (currentTheme == "light") {
    document.body.classList.toggle("light-theme");
    document.getElementById("navlogo").src =
      "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437395/Images/dark-logo_bab8me.png";
  }

  themeBtn.addEventListener("click", () => {
    if (userPreferedScheme.matches) {
      document.body.classList.toggle("light-theme");

      var theme = document.body.classList.contains("light-theme")
        ? "light"
        : "dark";
    } else {
      document.body.classList.toggle("dark-theme");

      var theme = document.body.classList.contains("dark-theme")
        ? "dark"
        : "light";
    }
    document.getElementById("navlogo").src =
      theme == "dark"
        ? "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437395/Images/light-logo_kugpz0.png"
        : "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437395/Images/dark-logo_bab8me.png";
    localStorage.setItem("theme", theme);
  });
};
themes();

// about page js
document.getElementById("backtohome").addEventListener("click", () => {
  document.querySelector("about").style.display = "none";
  document.querySelector("main").style.display = "block";
  document.querySelector("body").style.backgroundColor = "var(--bg-color)";

  themes;
});

document.getElementById("infoicon").addEventListener("click", () => {
  document.querySelector("main").style.display = "none";
  document.querySelector("about").style.display = "block";
  document.querySelector("body").style.backgroundColor = "#ff6600";
  themes;
});
