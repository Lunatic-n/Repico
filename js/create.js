const DB_NAME = "repico-db";
const STORE_NAME = "recipes";

let db;

function openDB(){
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
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

async function init(){
    db = await openDB();
}

init();

/* ===========================
   保存処理
=========================== */

document.querySelector(".save-button").addEventListener("click", async () => {

    const title = document.querySelector(".input-title").value;
    const people = document.querySelector(".input-people").value;
    const time = document.querySelector(".input-time").value;
    const tags = document.querySelector(".input-tags").value;

    const newRecipe = {
        title,
        people: Number(people || 1),
        time,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean)
    };

    await saveRecipe(newRecipe);

    alert("保存したで😎");

    location.href = "index.html";
});
