const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const gemsRoot = path.join(__dirname, "..", "gems");
const viewsRoot = path.join(gemsRoot, "views");

app.use(express.static(gemsRoot));

app.get("/", (_req, res) => {
  res.sendFile(path.join(viewsRoot, "student", "login.html"));
});

app.get("/admin", (_req, res) => {
  res.redirect("/views/admin/dashboard.html");
});

app.get("/admin/profile", (_req, res) => {
  res.sendFile(path.join(viewsRoot, "admin", "admin-profile.html"));
});

app.get("/student", (_req, res) => {
  res.redirect("/views/student/dashboard.html");
});

app.listen(PORT, () => {
  console.log(`GEMS dev server running at http://localhost:${PORT}`);
});
