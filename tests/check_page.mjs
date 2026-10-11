// Opens index.html in a pretend browser (jsdom) and checks the page's
// JavaScript works: the announcement banner fills in and every price
// category shows prices in the right format.
// Run it yourself with:  npm install --no-save jsdom  then  node tests/check_page.mjs

import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", error => errors.push("JavaScript error: " + error.message));

const dom = new JSDOM(html, {
    runScripts: "dangerously",
    virtualConsole,
    beforeParse(window) {
        // Pretend the backend answered with one announcement
        window.fetch = () => Promise.resolve({
            json: () => Promise.resolve([{ message: "Test announcement" }]),
        });
    },
});

// Give the pretend fetch a moment to finish
await new Promise(resolve => setTimeout(resolve, 200));

const document = dom.window.document;

const banner = document.getElementById("announcement-banner");
if (!banner) {
    errors.push("The announcement banner (#announcement-banner) is missing.");
} else if (banner.textContent !== "Test announcement") {
    errors.push("The announcement banner did not fill in from the backend's answer.");
}

const tabs = [...document.querySelectorAll(".price-tab")];
if (tabs.length === 0) {
    errors.push("No price category buttons were built. Check PRICE_LIST at the bottom of index.html.");
}

let totalRows = 0;
for (const tab of tabs) {
    tab.click();
    const rows = [...document.querySelectorAll(".price-row")];
    if (rows.length === 0) {
        errors.push(`The "${tab.textContent}" category shows no prices.`);
    }
    for (const row of rows) {
        const [name, price] = [...row.children].map(span => span.textContent);
        if (!name) errors.push(`An item in "${tab.textContent}" has no name.`);
        if (!/^\$\d+\.\d{2}$/.test(price)) {
            errors.push(`"${name}" in "${tab.textContent}" has a price that doesn't look like $0.00: "${price}"`);
        }
    }
    totalRows += rows.length;
}

if (errors.length > 0) {
    console.log("Problems found:");
    errors.forEach(error => console.log("  - " + error));
    process.exit(1);
}

console.log(`OK: banner works, ${tabs.length} price categories, ${totalRows} prices checked.`);
