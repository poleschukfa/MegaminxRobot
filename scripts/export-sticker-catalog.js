/**
 * Справочник всех наклеек для Python (формат stickers[]).
 * node scripts/export-sticker-catalog.js
 */
const path = require("path");
const fs = require("fs");

const topoPath = path.join(__dirname, "../MegaMinx/src/components/MegaMinx/stickerTopology.js");
const topoSrc = fs.readFileSync(topoPath, "utf8");

function extractArray(name) {
    const re = new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]);`);
    const m = topoSrc.match(re);
    if (!m) throw new Error(`Missing ${name}`);
    const S = (face, piece) => ({ face, piece });
    return eval(m[1]);
}

const CORNER_TOPOLOGY = extractArray("CORNER_TOPOLOGY");
const EDGE_TOPOLOGY = extractArray("EDGE_TOPOLOGY");

const catalog = [];

for (let face = 1; face <= 12; face++) {
    catalog.push({ face, piece: 0, role: "center" });
}

CORNER_TOPOLOGY.forEach((corner, cornerIndex) => {
    corner.forEach((entry, slot) => {
        catalog.push({
            face: entry.face,
            piece: entry.piece,
            role: "corner",
            cornerIndex,
            slot,
        });
    });
});

EDGE_TOPOLOGY.forEach((edge, edgeIndex) => {
    edge.forEach((entry, slot) => {
        catalog.push({
            face: entry.face,
            piece: entry.piece,
            role: "edge",
            edgeIndex,
            slot,
        });
    });
});

const outPath = path.join(__dirname, "sticker-catalog.json");
fs.writeFileSync(outPath, JSON.stringify({ count: catalog.length, stickers: catalog }, null, 2));
console.log(`Wrote ${catalog.length} entries -> ${outPath}`);
