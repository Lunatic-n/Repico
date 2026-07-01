const DB_NAME = "repico-db";
const STORE_NAME = "recipes";

const list = document.querySelector(".recipe-list");
const searchInput = document.querySelector(".search-input");
const countEl = document.getElementById("recipe-count-number");

const titleInput = document.querySelector(".input-title");
const peopleInput = document.querySelector(".input-people");
const timeInput = document.querySelector(".input-time");
const tagsInput = document.querySelector(".input-tags");
const saveButton = document.querySelector(".save-button");

let db;
let recipes = [];
let filtered = [];

/* ===========================
   DB
=========================== */

function openDB(){
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject();
    });
}

function getAllRecipes(){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
    });
}

function saveRecipe(recipe){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add(recipe);

        tx.oncomplete = () => resolve();
    });
}

/* ===========================
   描画
=========================== */

function render(data){

    list.innerHTML = "";

    data.forEach(r => {

        const card = document.createElement("div");
        card.className = "recipe-card";

        card.innerHTML = `
            <div class="recipe-thumb"></div>

            <div class="recipe-info">

                <div class="recipe-title">${r.title}</div>

                <div class="recipe-meta">
                    👥${r.people}人　⏱${r.time}
                </div>

                <div class="recipe-tags">
                    ${r.tags.map(t => `#${t}`).join(" ")}
                </div>

            </div>
        `;

        list.appendChild(card);
    });

    countEl.textContent = data.length;
}

/* ===========================
   検索
=========================== */

function filter(keyword){

    if (!keyword) {
        filtered = [...recipes];
    } else {
        filtered = recipes.filter(r =>
            r.title.includes(keyword) ||
            r.tags.some(t => t.includes(keyword))
        );
    }

    render(filtered);
}

searchInput.addEventListener("input", (e) => {
    filter(e.target.value);
});

/* ===========================
   保存
=========================== */

saveButton.addEventListener("click", async () => {

    const newRecipe = {
        title: titleInput.value,
        people: Number(peopleInput.value || 1),
        time: timeInput.value,
        tags: tagsInput.value.split(",").map(t => t.trim()).filter(Boolean)
    };

    await saveRecipe(newRecipe);

    recipes = await getAllRecipes();
    filter("");

    titleInput.value = "";
    peopleInput.value = "";
    timeInput.value = "";
    tagsInput.value = "";
});

/* ===========================
   初期化
=========================== */

async function init(){

    db = await openDB();

    recipes = await getAllRecipes();

    if (recipes.length === 0) {

        await saveRecipe({
            title: "オムライス",
            people: 2,
            time: "30分",
            tags: ["洋食", "卵", "簡単"]
        });

        await saveRecipe({
            title: "チャーハン",
            people: 1,
            time: "10分",
            tags: ["中華", "時短"]
        });

        recipes = await getAllRecipes();
    }

    filter("");
}

init();
