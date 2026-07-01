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
window.addEventListener("DOMContentLoaded", async () => {
    db = await openDB();

    /* 画像 */
    const photoInput = document.getElementById("photo-input");
    const photoBox = document.querySelector(".photo-box");
    const photoPreview = document.querySelector(".photo-preview");

    photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            photoBox.classList.add("has-image");
            photoPreview.src = reader.result;
        };

        reader.readAsDataURL(file);
    });

    /* 材料 */
    const ingredientList = document.getElementById("ingredient-list");
    document.getElementById("add-ingredient").addEventListener("click", () => {

        const row = document.createElement("div");
        row.className = "ingredient-row";

        row.innerHTML = `
            <input type="text" placeholder="材料名">
            <input type="text" placeholder="量">
            <button type="button" class="remove-btn"></button>
        `;

        row.querySelector(".remove-btn").addEventListener("click", () => row.remove());

        ingredientList.appendChild(row);
    });

    /* 手順 */
    const stepList = document.getElementById("step-list");
    document.getElementById("add-step").addEventListener("click", () => {

        const row = document.createElement("div");
        row.className = "step-row";

        row.innerHTML = `
            <span class="step-num">${stepList.children.length + 1}</span>
            <textarea placeholder="手順"></textarea>
            <button type="button" class="remove-btn"></button>
        `;

        row.querySelector(".remove-btn").addEventListener("click", () => {
            row.remove();
        });

        stepList.appendChild(row);
    });

    /* 保存 */
    document.querySelector(".save-button").addEventListener("click", async () => {

        const ok = confirm("このレシピを保存しますか？");
        if (!ok) return;

        const ingredients = [...ingredientList.children].map(row => ({
            name: row.children[0].value,
            amount: row.children[1].value
        }));

        const steps = [...stepList.children].map(row =>
            row.querySelector("textarea").value
        );

        const photoPreview = document.querySelector(".photo-preview");

        const recipe = {
            title: document.querySelector(".input-title").value,
            people: Number(document.querySelector(".input-people").value || 1),
            time: document.querySelector(".input-time").value,
            tags: document.querySelector(".input-tags").value
                .split(",").map(t => t.trim()).filter(Boolean),
            desc: document.querySelector(".input-desc").value,
            note: document.querySelector(".input-note").value,
            ingredients,
            steps,
            image: photoPreview?.src || null
        };

        await saveRecipe(recipe);

        alert("保存しました！🍳");
        location.href = "index.html";
    });
});
