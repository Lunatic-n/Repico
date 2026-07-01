const DB_NAME = "repico-db";
const STORE_NAME = "recipes";

let db;

/* DB */
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

/* init */
async function init(){
    db = await openDB();
}
init();

/* 写真プレビュー */
const photoInput = document.getElementById("photo-input");
const photoBox = document.querySelector(".photo-box");

photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        photoBox.innerHTML = `<img src="${reader.result}">`;
    };
    reader.readAsDataURL(file);
});

/* 保存 */
document.querySelector(".save-button").addEventListener("click", async () => {

    const ok = confirm("このレシピ保存するで？");
    if (!ok) return;

    const title = document.querySelector(".input-title").value;

    const recipe = {
        title,
        people: Number(document.querySelector(".input-people").value || 1),
        time: document.querySelector(".input-time").value,
        tags: document.querySelector(".input-tags").value
            .split(",").map(t => t.trim()).filter(Boolean),
        desc: document.querySelector(".input-desc").value,
        note: document.querySelector(".input-note").value,
        image: photoBox.querySelector("img")?.src || null
    };

    await saveRecipe(recipe);

    alert("保存したで😎🍳");
    location.href = "index.html";
});
