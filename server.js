const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3500;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", apiRoutes);

app.use("/api", (req, res) => {
    res.status(404).json({error: "Endpoint not found"});
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
    console.log(`Pinpoint Distance running at http://localhost:${PORT}`);
});