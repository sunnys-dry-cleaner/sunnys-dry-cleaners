// Opens the pages in a pretend browser (jsdom) and checks their JavaScript
// works: the announcement banner fills in (or stays empty when there are no
// announcements) on both pages, the home page shows no prices, and every
// category on prices.html shows prices in the right format.
// Run it yourself with:  npm install --no-save jsdom  then  node tests/check_page.mjs

import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";

const errors = [];

// Load a page, pretending the backend answered with `announcements`
async function loadPage(file, announcements) {
    const html = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", error => errors.push("JavaScript error: " + error.message));

    const dom = new JSDOM(html, {
        runScripts: "dangerously",
        virtualConsole,
        beforeParse(window) {
            window.fetch = () => Promise.resolve({
                json: () => Promise.resolve(announcements),
            });
        },
    });

    // Give the pretend fetch a moment to finish
    await new Promise(resolve => setTimeout(resolve, 200));
    return dom.window.document;
}


// ---------- Announcement banner (on every page) ----------

for (const file of ["index.html", "prices.html"]) {
    // With an announcement: the banner shows it
    const page = await loadPage(file, [{ message: "Test announcement" }]);
    const banner = page.getElementById("announcement-banner");
    if (!banner) {
        errors.push(`${file}: the announcement banner (#announcement-banner) is missing.`);
    } else if (banner.textContent !== "Test announcement") {
        errors.push(`${file}: the announcement banner did not fill in from the backend's answer.`);
    }

    // With no announcements: the banner stays empty, so CSS (:empty) hides it
    const emptyPage = await loadPage(file, []);
    const emptyBanner = emptyPage.getElementById("announcement-banner");
    if (emptyBanner && emptyBanner.textContent !== "") {
        errors.push(`${file}: with no announcements, the banner should stay empty (hidden), but it shows: "${emptyBanner.textContent}"`);
    }
}


// ---------- Prices stay off the home page ----------

const home = await loadPage("index.html", []);
if (home.querySelector(".price-row, .price-tab, #prices")) {
    errors.push("index.html: prices should only be on prices.html, not the home page.");
}


// ---------- Price list on prices.html ----------

const document = await loadPage("prices.html", []);
const tabs = [...document.querySelectorAll(".price-tab")];
if (tabs.length === 0) {
    errors.push("No price category buttons were built. Check PRICE_LIST at the bottom of prices.html.");
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

console.log(`OK: banner works on both pages, no prices on the home page, ${tabs.length} price categories and ${totalRows} prices checked on prices.html.`);
