const express = require("express");
const geo = require("../services/geo");
const store = require("../services/store");

const router = express.Router();

router.get("/geocode", async (req, res) => {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing search text (q)" });
    try {
        const place = await geo.geocode(q);  
        if (!place) return res.status(404).json({ error: "No place found with that description"});
        res.json(place); 
    }   catch (err) {
        res.status(502).json({ error: err.message});
    }
});

router.post("/distance", async (req, res) => {
    const { from, to } = req.body || {};
    if (!geo.isValidPoint(from) || !geo.isValidPoint(to)) {
        return res.status(400).json({ error: "Send 'from' and 'to' as { lat, lng } numbers"});
    }
    const straightKm = geo.haversine(from, to);
    let route = null;
    try {
        route = await geo.drivingRoute(from, to);
    }   catch (err) {
        console.warn("Route lookup failed:", err.message);
    }
    res.json({ straightKim, route });
});

router.get("/places", async (req, res, next) => {
    try {
        res.json(await store.list());
    }   catch (err) { next(err); }
});

router.post("/places", async (req, res, next) => {
    const { name, lat, lng } = req.body || {};
    if (!geo.isValidPoint({ lat, lng })) {
        return res.status(400).json({ error: "lat and lng must be valid numbers "});
    }
    const cleanName = String(name || "Pinned location").trim().slice(0, 120);
    try {
        res.status(201).json(await store.add({ name: cleanName, lat, lng }));
    }  catch (err) { next(err); }
});

router.delete("/places/:id", async (req, res, next) => {
    try {
        const removed = await store.remove(req.params.id);
        if (!removed) return res.status(404).json({ error: "Saved place not found" });
        res.status(204).end();
    }   catch (err) { next(err)};
});

module.exports = router;