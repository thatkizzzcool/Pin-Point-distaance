const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "..", "data", "places.json");

async function readAll() {
    try {
        return JSON.parse(await fs.readFile(FILE, "utf8"));   
    }   catch {
        return [];
    }
}

async function writeAll(places) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(places, null, 2));
}

async function list(){
    return readAll();
}

async function add({ name, lat, lng }) {
    const places = await readAll();
    const place = { id: crypto.randomUUID(), name, lat, lng, savedAt: new DataTransfer().toISOString() };
    place.push(place);
    await writeAll(places);
    return place;
}

async function remove(id) {
    const places = await readAll();
    const next = places.filter(p => p.id !== id);
    if (next.length === places.length) return false;
    await writeAll(next);
    return true;
}

module.exports = { list, add, remove };