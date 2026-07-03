const DB_NAME = "repico-db";
const STORE_NAME = "recipes";
const DB_VERSION = 2;

let db;

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

function saveRecipe(recipe){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add(recipe);
        tx.oncomplete = () => resolve();
    });
}

function updateRecipe(recipe){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(recipe);
        tx.oncomplete = () => resolve();
    });
}

function getRecipeById(id){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
    });
}

let tags = [];
let editingId = null;

window.addEventListener("DOMContentLoaded", async () => {

    db = await openDB();

    /* ===========================
       編集モード判定
    =========================== */

    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    editingId = idParam ? Number(idParam) : null;

    const tagInput = document.getElementById("tag-input");
    const tagList = document.getElementById("tag-list");

    const photoInput = document.getElementById("photo-input");
    const photoBox = document.querySelector(".photo-box");
    const photoPreview = document.querySelector(".photo-preview");
    const saveButton = document.querySelector(".save-button");

    let imageData = null;
    let existingShareId = null;

    /* ===========================
       画像圧縮
    =========================== */

    function compressImage(file, maxSize = 800, quality = 0.75) {
        return new Promise((resolve) => {

            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;

                img.onload = () => {

                    let { width, height } = img;

                    if (width > height && width > maxSize) {
                        height = height * (maxSize / width);
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = width * (maxSize / height);
                        height = maxSize;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    canvas.getContext("2d").drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL("image/jpeg", quality));
                };
            };

            reader.readAsDataURL(file);
        });
    }

    /* ===========================
       タグ追加（Enter）
    =========================== */
    tagInput.addEventListener("keydown", (e) => {

        if (e.key !== "Enter") return;
        e.preventDefault();

        const value = tagInput.value.trim();

        if (!value) return;
        if (tags.length >= 3) return;
        if (tags.includes(value)) return;

        tags.push(value);
        tagInput.value = "";
        renderTags();
    });

    function renderTags(){
        tagList.innerHTML = "";

        tags.forEach((t, index) => {

            const el = document.createElement("div");
            el.className = "tag-item";

            el.innerHTML = `
                <span>${t}</span>
                <button type="button" class="tag-remove">×</button>
            `;

            el.querySelector(".tag-remove").onclick = () => {
                tags.splice(index, 1);
                renderTags();
            };

            tagList.appendChild(el);
        });
    }

    /* ===========================
       画像（メイン写真）
    =========================== */
    photoInput.addEventListener("change", async (e) => {

        const file = e.target.files[0];
        if (!file) return;

        imageData = await compressImage(file);

        photoPreview.src = imageData;
        photoPreview.style.display = "block";
        photoBox.classList.add("has-image");
    });

    /* ===========================
       textarea高さ自動調整
    =========================== */

    function autoResizeTextarea(textarea) {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    }

    /* ===========================
       補足欄の自動伸長
    =========================== */

    const supplementTextarea = document.querySelector(".input-supplement");

    if (supplementTextarea) {
        supplementTextarea.addEventListener("input", () => autoResizeTextarea(supplementTextarea));
    }

    /* ===========================
       行内写真の追加・削除
    =========================== */

    function setupRowPhoto(row){

        const rowPhotoInput = row.querySelector(".row-photo-input");
        const rowPhotoBox = row.querySelector(".row-photo-box");
        const rowPhotoPreview = row.querySelector(".row-photo-preview");
        const rowPhotoRemoveBtn = row.querySelector(".row-photo-remove-btn");

        /* 画像追加（圧縮してから反映） */
        rowPhotoInput.addEventListener("change", async (e) => {

            const file = e.target.files[0];
            if (!file) return;

            rowPhotoPreview.src = await compressImage(file);
            rowPhotoPreview.style.display = "block";
            rowPhotoBox.classList.add("has-image");
        });

        /* 画像だけ削除 */
        rowPhotoRemoveBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            rowPhotoInput.value = "";
            rowPhotoPreview.src = "";
            rowPhotoPreview.style.display = "none";
            rowPhotoBox.classList.remove("has-image");
        });
    }

    /* 既存データを行内写真にセット（編集モード用） */
    function setRowPhoto(row, imageSrc){
        if (!imageSrc) return;

        const rowPhotoBox = row.querySelector(".row-photo-box");
        const rowPhotoPreview = row.querySelector(".row-photo-preview");

        rowPhotoPreview.src = imageSrc;
        rowPhotoPreview.style.display = "block";
        rowPhotoBox.classList.add("has-image");
    }

    /* ===========================
       カテゴリ・材料（作成/編集共通関数）
    =========================== */

    const addCategoryBtn = document.getElementById("add-category");
    const categoryList = document.getElementById("category-list");

    function createOption(group, optionData){
        const option = document.createElement("div");
        option.className = "ingredient-option";
        option.innerHTML = `
            <input type="text" placeholder="材料名">
            <input type="text" placeholder="分量">
            <button type="button" class="ingredient-remove-btn">✖</button>
        `;

        if (optionData) {
            const inputs = option.querySelectorAll("input");
            inputs[0].value = optionData.name || "";
            inputs[1].value = optionData.amount || "";
        }

        option.querySelector(".ingredient-remove-btn").addEventListener("click", () => {
            const optionCount = group.querySelectorAll(".ingredient-option").length;

            if (optionCount <= 1) {
                group.remove();
            } else {
                const prev = option.previousElementSibling;
                if (prev && prev.classList.contains("or-label")) {
                    prev.remove();
                }
                option.remove();
            }
        });

        return option;
    }

    function createIngredientGroup(ingredientList, groupData){

        const group = document.createElement("div");
        group.className = "ingredient-group";

        const items = groupData && groupData.length > 0 ? groupData : [null];

        items.forEach((item, index) => {
            if (index > 0) {
                const orLabel = document.createElement("div");
                orLabel.className = "or-label";
                orLabel.textContent = "または";
                group.appendChild(orLabel);
            }
            group.appendChild(createOption(group, item));
        });

        const addOrBtn = document.createElement("button");
        addOrBtn.type = "button";
        addOrBtn.className = "add-or-btn";
        addOrBtn.textContent = "＋または";

        addOrBtn.addEventListener("click", () => {
            const orLabel = document.createElement("div");
            orLabel.className = "or-label";
            orLabel.textContent = "または";

            group.insertBefore(orLabel, addOrBtn);
            group.insertBefore(createOption(group, null), addOrBtn);
        });

        group.appendChild(addOrBtn);

        ingredientList.appendChild(group);
    }

    function createCategoryBlock(categoryData){

        const block = document.createElement("div");
        block.className = "category-block";

        block.innerHTML = `
            <div class="category-row">
                <input type="text" placeholder="カテゴリ名" class="category-input">
                <button type="button" class="category-remove-btn">✖</button>
            </div>

            <button type="button" class="add-ingredient-btn">＋材料を追加</button>

            <div class="ingredient-list"></div>
        `;

        if (categoryData) {
            block.querySelector(".category-input").value = categoryData.name || "";
        }

        const removeBtn = block.querySelector(".category-remove-btn");
        const ingredientList = block.querySelector(".ingredient-list");
        const addIngredientBtn = block.querySelector(".add-ingredient-btn");

        removeBtn.addEventListener("click", () => {
            block.remove();
        });

        addIngredientBtn.addEventListener("click", () => {
            createIngredientGroup(ingredientList, null);
        });

        if (categoryData && categoryData.groups) {
            categoryData.groups.forEach(groupData => {
                createIngredientGroup(ingredientList, groupData);
            });
        }

        categoryList.appendChild(block);
    }

    if (addCategoryBtn && categoryList) {
        addCategoryBtn.addEventListener("click", () => {
            createCategoryBlock(null);
        });
    } else {
        console.error("カテゴリ要素がHTMLに存在しない");
    }

    /* ===========================
       下準備追加（作成/編集共通関数）
    =========================== */

    const addPreparationBtn = document.getElementById("add-preparation-step");
    const preparationList = document.getElementById("preparation-list");

    function createPreparationRow(prepData){

        const row = document.createElement("div");
        row.className = "preparation-row";

        row.innerHTML = `
            <div class="preparation-content">
                <textarea placeholder="下ごしらえ内容" rows="1"></textarea>

                <label class="row-photo-box">
                    <input type="file" accept="image/*" hidden class="row-photo-input">
                    <div class="row-photo-placeholder">📷</div>
                    <img class="row-photo-preview" alt="">
                    <button type="button" class="row-photo-remove-btn">✖</button>
                </label>
            </div>

            <button type="button" class="preparation-remove-btn">✖</button>
        `;

        const textarea = row.querySelector("textarea");

        if (prepData) {
            textarea.value = prepData.text || "";
            setRowPhoto(row, prepData.image);
        }

        textarea.addEventListener("input", () => autoResizeTextarea(textarea));
        setupRowPhoto(row);

        row.querySelector(".preparation-remove-btn").addEventListener("click", () => {
            row.remove();
            if (preparationList.children.length === 0) {
                addPreparationBtn.style.display = "block";
            }
        });

        preparationList.appendChild(row);

        /* 高さ自動調整（値をセットした直後に反映） */
        requestAnimationFrame(() => autoResizeTextarea(textarea));
    }

    if (addPreparationBtn && preparationList) {

        addPreparationBtn.addEventListener("click", () => {
            createPreparationRow(null);
            addPreparationBtn.style.display = "none";
        });

    } else {
        console.error("下準備要素がHTMLに存在しない");
    }

    /* ===========================
       手順追加（作成/編集共通関数）
    =========================== */

    const addStepBtn = document.getElementById("add-step");
    const stepList = document.getElementById("step-list");

    function renumberSteps() {
        stepList.querySelectorAll(".step-row").forEach((row, index) => {
            row.querySelector(".step-number").textContent = `${index + 1}.`;
        });
    }

    function createStepRow(stepData){

        const row = document.createElement("div");
        row.className = "step-row";

        row.innerHTML = `
            <span class="step-number"></span>

            <div class="preparation-content">
                <textarea placeholder="手順を入力" rows="1"></textarea>

                <label class="row-photo-box">
                    <input type="file" accept="image/*" hidden class="row-photo-input">
                    <div class="row-photo-placeholder">📷</div>
                    <img class="row-photo-preview" alt="">
                    <button type="button" class="row-photo-remove-btn">✖</button>
                </label>
            </div>

            <button type="button" class="step-remove-btn">✖</button>
        `;

        const textarea = row.querySelector("textarea");

        if (stepData) {
            textarea.value = stepData.text || "";
            setRowPhoto(row, stepData.image);
        }

        textarea.addEventListener("input", () => autoResizeTextarea(textarea));
        setupRowPhoto(row);

        row.querySelector(".step-remove-btn").addEventListener("click", () => {
            row.remove();
            renumberSteps();
        });

        stepList.appendChild(row);
        renumberSteps();

        requestAnimationFrame(() => autoResizeTextarea(textarea));
    }

    if (addStepBtn && stepList) {

        addStepBtn.addEventListener("click", () => {
            createStepRow(null);
        });

    } else {
        console.error("手順要素がHTMLに存在しない");
    }

    /* ===========================
       行データ収集ヘルパー
    =========================== */

    function getRowImage(row){
        const box = row.querySelector(".row-photo-box");
        const hasImage = box?.classList.contains("has-image");
        if (!hasImage) return null;

        return row.querySelector(".row-photo-preview")?.src || null;
    }

    function collectCategories(){
        const categories = [];

        document.querySelectorAll(".category-block").forEach(block => {

            const name = block.querySelector(".category-input")?.value || "";
            const groups = [];

            block.querySelectorAll(".ingredient-group").forEach(group => {

                const options = [];

                group.querySelectorAll(".ingredient-option").forEach(option => {
                    const inputs = option.querySelectorAll("input");
                    const ingName = inputs[0]?.value || "";
                    const ingAmount = inputs[1]?.value || "";

                    if (ingName || ingAmount) {
                        options.push({ name: ingName, amount: ingAmount });
                    }
                });

                if (options.length > 0) {
                    groups.push(options);
                }
            });

            if (name || groups.length > 0) {
                categories.push({ name, groups });
            }
        });

        return categories;
    }

    function collectPreparations(){
        const preparations = [];

        document.querySelectorAll(".preparation-row").forEach(row => {
            const text = row.querySelector("textarea")?.value || "";
            const image = getRowImage(row);

            if (text || image) {
                preparations.push({ text, image });
            }
        });

        return preparations;
    }

    function collectSteps(){
        const steps = [];

        document.querySelectorAll(".step-row").forEach(row => {
            const text = row.querySelector("textarea")?.value || "";
            const image = getRowImage(row);

            if (text || image) {
                steps.push({ text, image });
            }
        });

        return steps;
    }

    function buildRecipeObject(){

        const hour = Number(document.querySelector(".input-hour")?.value) || 0;
        const minute = Number(document.querySelector(".input-minute")?.value) || 0;

        return {
            title: document.querySelector(".input-title")?.value || "",
            desc: document.querySelector(".input-desc")?.value || "",
            image: imageData,
            tags: [...tags],

            people: document.querySelector(".input-people")?.value || "",
            time: hour * 60 + minute,

            categories: collectCategories(),
            preparations: collectPreparations(),
            steps: collectSteps(),
            supplement: document.querySelector(".input-supplement")?.value || "",
            shareId: existingShareId,

            createdAt: Date.now()
        };
    }

    /* ===========================
       編集モード：既存データの読み込み
    =========================== */

    if (editingId !== null) {

        const existing = await getRecipeById(editingId);

        if (existing) {

            existingShareId = existing.shareId || null;

            /* タイトル・説明 */
            document.querySelector(".input-title").value = existing.title || "";
            document.querySelector(".input-desc").value = existing.desc || "";

            /* タグ */
            tags = [...(existing.tags || [])];
            renderTags();

            /* 画像 */
            if (existing.image) {
                imageData = existing.image;
                photoPreview.src = imageData;
                photoPreview.style.display = "block";
                photoBox.classList.add("has-image");
            }

            /* 人数・時間 */
            document.querySelector(".input-people").value = existing.people || "";

            const totalMinutes = Number(existing.time || 0);
            document.querySelector(".input-hour").value = Math.floor(totalMinutes / 60) || "";
            document.querySelector(".input-minute").value = totalMinutes % 60 || "";

            /* 材料 */
            (existing.categories || []).forEach(cat => {
                createCategoryBlock(cat);
            });

            /* 下ごしらえ */
            (existing.preparations || []).forEach(prep => {
                createPreparationRow(prep);
            });
            if (preparationList.children.length > 0) {
                addPreparationBtn.style.display = "none";
            }

            /* 手順 */
            (existing.steps || []).forEach(step => {
                createStepRow(step);
            });

            /* 補足 */
            if (existing.supplement) {
                supplementTextarea.value = existing.supplement;
                requestAnimationFrame(() => autoResizeTextarea(supplementTextarea));
            }

            /* 画面表示の切り替え（作成→編集） */
            const pageTitle = document.querySelector(".page-title");
            if (pageTitle) pageTitle.textContent = "✨レシピ編集✨";

            saveButton.textContent = "💾更新";

            const confirmMessage = document.querySelector("#confirm-modal .modal-message");
            if (confirmMessage) confirmMessage.textContent = "更新しますか？";

            const doneMessage = document.querySelector("#done-modal .modal-message");
            if (doneMessage) doneMessage.textContent = "更新しました";

        } else {
            console.error("編集対象のレシピが見つかりません");
            editingId = null;
        }
    }

    /* ===========================
       保存（IndexedDB）
    =========================== */
    saveButton.addEventListener("click", async () => {

        const ok = await showConfirmModal();
        if (!ok) return;

        const recipe = buildRecipeObject();

        if (editingId !== null) {
            recipe.id = editingId;
            await updateRecipe(recipe);
        } else {
            await saveRecipe(recipe);
        }

        await showDoneModal();

        if (editingId !== null) {
            window.location.href = `view.html?id=${editingId}`;
        } else {
            window.location.href = "index.html";
        }
    });

    /* ===========================
       モーダル制御（confirm・alertの代わり）
    =========================== */

    function showConfirmModal(){
        return new Promise((resolve) => {

            const modal = document.getElementById("confirm-modal");
            const okBtn = document.getElementById("confirm-ok");
            const cancelBtn = document.getElementById("confirm-cancel");

            modal.classList.add("show");

            function cleanup(result){
                modal.classList.remove("show");
                okBtn.removeEventListener("click", onOk);
                cancelBtn.removeEventListener("click", onCancel);
                resolve(result);
            }

            function onOk(){ cleanup(true); }
            function onCancel(){ cleanup(false); }

            okBtn.addEventListener("click", onOk);
            cancelBtn.addEventListener("click", onCancel);
        });
    }

    function showDoneModal(){
        return new Promise((resolve) => {

            const modal = document.getElementById("done-modal");
            const okBtn = document.getElementById("done-ok");

            modal.classList.add("show");

            function onOk(){
                modal.classList.remove("show");
                okBtn.removeEventListener("click", onOk);
                resolve();
            }

            okBtn.addEventListener("click", onOk);
        });
    }

});
