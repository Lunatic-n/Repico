const DB_NAME = "repico-db";
const STORE_NAME = "recipes";

let db;

/* ===========================
   DB初期化
=========================== */

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

async function init(){
    db = await openDB();
}

init();

/* ===========================
   保存処理
=========================== */

function saveRecipe(recipe){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        store.add(recipe);

        tx.oncomplete = () => resolve();
    });
}

/* ===========================
   保存ボタン
=========================== */

document.querySelector(".save-button").addEventListener("click", async () => {

    const title = document.querySelector(".input-title").value.trim();
    const people = document.querySelector(".input-people").value;
    const time = document.querySelector(".input-time").value.trim();
    const tags = document.querySelector(".input-tags").value;

    if (!title) {
        alert("レシピ名");
        return;
    }

    const ok = confirm("レシピを保存しますか？");

    if (!ok) return;

    const newRecipe = {
        title,
        people: Number(people || 1),
        time,
        tags: tags
            ? tags.split(",").map(t => t.trim()).filter(Boolean)
            : []
    };

    await saveRecipe(newRecipe);

    alert("保存しました！");

    location.href = "index.html";
});
