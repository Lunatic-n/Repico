const DB_NAME = "repico-db";
const STORE_NAME = "recipes";
const DB_VERSION = 2;

let db;
let allRecipes = [];
let filtered = [];

/* ===========================
   DB接続
=========================== */

function openDB(){
    return new Promise((resolve) => {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
    });
}

/* ===========================
   データ取得
=========================== */

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
        const req = store.add(recipe);
        req.onsuccess = () => resolve(req.result);
    });
}


/* ===========================
   並び替え
=========================== */
let currentSort = "newest";

function sortRecipes(data, sortType){

    const sorted = [...data];

    if (sortType === "newest") {
        sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortType === "oldest") {
        sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else if (sortType === "title") {
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja"));
    }

    return sorted;
}

/* ===========================
   検索
=========================== */
function filterRecipes(keyword){

    if (!keyword) {
        filtered = [...allRecipes];
    } else {
        filtered = allRecipes.filter(r =>
            r.title.includes(keyword) ||
            (r.tags || []).some(t => t.includes(keyword))
        );
    }

    filtered = sortRecipes(filtered, currentSort);

    render(filtered);
}

/* ===========================
   表示
=========================== */
function render(data){

    const list = document.querySelector(".recipe-list");
    const count = document.getElementById("recipe-count-number");

    list.innerHTML = "";

    data.forEach(r => {

        const card = document.createElement("div");
        card.className = "recipe-card";
        card.style.cursor = "pointer";

        card.addEventListener("click", () => {
            window.location.href = `view.html?id=${r.id}`;
        });

        const img = r.image
            ? `<img src="${r.image}" class="thumb">`
            : `<div class="thumb no-img">🍳</div>`;

        card.innerHTML = `
            ${img}

            <div class="recipe-info">

                <div class="recipe-title">
                    ${r.title || "無題レシピ"}
                </div>

                <div class="recipe-meta">
                    <span class="meta-item">👥 ${r.people || "-"}人前</span>
                    <span class="meta-item">⏱ ${Math.floor((Number(r.time || 0)) / 60)}時間 ${(Number(r.time || 0)) % 60}分</span> 
                </div>

                <div class="recipe-tags">
                    ${(r.tags || []).map(t => `
                        <span class="tag-chip">${t}</span> 
                    `).join("")}   
                </div>

            </div>
        `;

        list.appendChild(card);
    });

    count.textContent = data.length;
}

/* ===========================
   init
=========================== */
window.addEventListener("DOMContentLoaded", async () => {

    db = await openDB();

    allRecipes = await getAllRecipes();
    filtered = sortRecipes(allRecipes, currentSort);

    render(filtered);

    /* 検索UI（存在する場合だけ動く） */
    const searchInput = document.querySelector(".search-input");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            filterRecipes(e.target.value);
        });
    }

    /* 並び替えUI */
    const sortButton = document.getElementById("sort-button");
    const sortMenu = document.getElementById("sort-menu");

    if (sortButton && sortMenu) {

        sortButton.addEventListener("click", (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle("show");
        });

        /* メニュー外をタップしたら閉じる */
        document.addEventListener("click", () => {
            sortMenu.classList.remove("show");
        });

        /* 初期状態のactive表示 */
        updateSortActiveState();

        sortMenu.querySelectorAll(".sort-option").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();

                currentSort = btn.dataset.sort;
                updateSortActiveState();

                const searchInput = document.querySelector(".search-input");
                filterRecipes(searchInput ? searchInput.value : "");

                sortMenu.classList.remove("show");
            });
        });
    }

    function updateSortActiveState(){
        sortMenu.querySelectorAll(".sort-option").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.sort === currentSort);
        });
    }

    // アップデート通知
    const versionLink = document.getElementById("version-link");
    const dot = document.getElementById("update-dot");

    if (versionLink && dot) {

        const latestVersion = versionLink.textContent.trim();
        const seenVersion = localStorage.getItem("updateSeen");

        if (seenVersion === latestVersion) {
            dot.style.display = "none";
        }
    }

    /* ===========================
       インポート機能
    =========================== */

    const importBtn = document.getElementById("import-button");
    const importModal = document.getElementById("import-modal");
    const importCancel = document.getElementById("import-cancel");
    const importIdInput = document.getElementById("import-id-input");
    const importError = document.getElementById("import-error");
    const importFetchBtn = document.getElementById("import-fetch-btn");

    const importConfirmModal = document.getElementById("import-confirm-modal");
    const importConfirmCancel = document.getElementById("import-confirm-cancel");
    const importConfirmOk = document.getElementById("import-confirm-ok");
    const importPreviewThumb = document.getElementById("import-preview-thumb");
    const importPreviewTitle = document.getElementById("import-preview-title");

    const importSuccessModal = document.getElementById("import-success-modal");
    const importSuccessOk = document.getElementById("import-success-ok");

    let pendingImportRecipe = null;

    /* URLで貼られても、IDだけ入力されても対応できるように抽出 */
    function extractShareId(input){
        const trimmed = input.trim();
        if (!trimmed) return "";

        const match = trimmed.match(/[?&]id=([^&]+)/);
        if (match) return match[1];

        if (trimmed.includes("/")) {
            const parts = trimmed.split("/").filter(Boolean);
            return parts[parts.length - 1];
        }

        return trimmed;
    }

    if (importBtn && importModal) {

        importBtn.addEventListener("click", () => {
            importIdInput.value = "";
            importError.style.display = "none";
            importModal.classList.add("show");
        });

        importCancel.addEventListener("click", () => {
            importModal.classList.remove("show");
        });

        importFetchBtn.addEventListener("click", async () => {

            const shareId = extractShareId(importIdInput.value);

            if (!shareId) {
                importError.textContent = "IDを入力してください";
                importError.style.display = "block";
                return;
            }

            importFetchBtn.disabled = true;
            const originalLabel = importFetchBtn.textContent;
            importFetchBtn.textContent = "検索中...";
            importError.style.display = "none";

            try {
                const { data, error } = await window.supabase
                    .from("shared_recipes")
                    .select("recipe_data")
                    .eq("short_id", shareId)
                    .maybeSingle();

                if (error || !data) {
                    importError.textContent = "レシピが見つかりませんでした";
                    importError.style.display = "block";
                    return;
                }

                pendingImportRecipe = data.recipe_data;

                importModal.classList.remove("show");

                importPreviewTitle.textContent = pendingImportRecipe.title || "無題レシピ";

                if (pendingImportRecipe.image) {
                    importPreviewThumb.src = pendingImportRecipe.image;
                    importPreviewThumb.style.display = "block";
                } else {
                    importPreviewThumb.style.display = "none";
                }

                importConfirmModal.classList.add("show");

            } catch (err) {
                console.error(err);
                importError.textContent = "通信エラーが発生しました";
                importError.style.display = "block";

            } finally {
                importFetchBtn.disabled = false;
                importFetchBtn.textContent = originalLabel;
            }
        });

        importConfirmCancel.addEventListener("click", () => {
            importConfirmModal.classList.remove("show");
            pendingImportRecipe = null;
        });

        importConfirmOk.addEventListener("click", async () => {

            if (!pendingImportRecipe) return;

            importConfirmOk.disabled = true;
            const originalLabel = importConfirmOk.textContent;
            importConfirmOk.textContent = "保存中...";

            try {
                const recipeToSave = {
                    ...pendingImportRecipe,
                    isImported: true,
                    createdAt: Date.now()
                };
                delete recipeToSave.id;

                await saveRecipe(recipeToSave);

                importConfirmModal.classList.remove("show");
                importSuccessModal.classList.add("show");

                pendingImportRecipe = null;

                /* 一覧を再読み込み */
                allRecipes = await getAllRecipes();
                filtered = sortRecipes(allRecipes, currentSort);
                render(filtered);

            } catch (err) {
                console.error(err);
                alert("保存に失敗しました。時間をおいて再度お試しください");

            } finally {
                importConfirmOk.disabled = false;
                importConfirmOk.textContent = originalLabel;
            }
        });

        importSuccessOk.addEventListener("click", () => {
            importSuccessModal.classList.remove("show");
        });
    }

});