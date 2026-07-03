const DB_NAME = "repico-db";
const STORE_NAME = "recipes";
const DB_VERSION = 2;

let db;
let currentRecipe = null;
let currentId = null;

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

function getRecipeById(id){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
    });
}

function saveRecipe(recipe){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(recipe);
        req.onsuccess = () => resolve(req.result); // 新しく発行されたIDを返す
    });
}

function deleteRecipeById(id){
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
}

const SHARE_LIMIT = 30; // 1ユーザーあたりの共有上限（仮）

let isSharedView = false; // Supabase経由（共有リンク）で開いているか

window.addEventListener("DOMContentLoaded", async () => {

    db = await openDB();

    /* ===========================
       URLからID/共有ID取得
    =========================== */

    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const shareParam = params.get("share");

    if (idParam) {
        /* ローカル（IndexedDB）のレシピを表示 */
        currentId = Number(idParam);
        currentRecipe = await getRecipeById(currentId);

        if (!currentRecipe) {
            alert("レシピが見つかりませんでした");
            window.location.href = "index.html";
            return;
        }

        renderRecipe(currentRecipe);

    } else if (shareParam) {
        /* 共有リンク経由（Supabase）のレシピを表示 */
        isSharedView = true;

        const { data, error } = await window.supabase
            .from("shared_recipes")
            .select("recipe_data")
            .eq("id", shareParam)
            .maybeSingle();

        if (error || !data) {
            alert("共有されたレシピが見つかりませんでした");
            window.location.href = "index.html";
            return;
        }

        currentRecipe = data.recipe_data;
        renderRecipe(currentRecipe);

        /* 共有ビューでは編集・削除・共有ボタンを隠し、保存ボタンを出す */
        document.getElementById("edit-btn").style.display = "none";
        document.getElementById("delete-btn").style.display = "none";
        document.getElementById("share-btn").style.display = "none";
        document.getElementById("save-shared-btn").style.display = "block";

    } else {
        alert("レシピが見つかりませんでした");
        window.location.href = "index.html";
        return;
    }

    /* ===========================
       描画処理
    =========================== */

    function renderRecipe(recipe){

        /* タイトル（上部・本文） */
        document.getElementById("recipe-title").textContent = recipe.title || "無題レシピ";

        /* 説明 */
        const descEl = document.getElementById("recipe-desc");
        if (recipe.desc) {
            descEl.textContent = recipe.desc;
            descEl.style.display = "block";
        } else {
            descEl.style.display = "none";
        }

        /* メイン画像 */
        const mainPhotoBox = document.getElementById("main-photo-box");
        const mainPhotoPreview = document.getElementById("main-photo-preview");

        if (recipe.image) {
            mainPhotoPreview.src = recipe.image;
            mainPhotoBox.classList.add("has-image");
        }

        /* タグ */
        const tagList = document.getElementById("tag-list");
        tagList.innerHTML = "";

        (recipe.tags || []).forEach(t => {
            const el = document.createElement("div");
            el.className = "tag-item";
            el.innerHTML = `<span>${escapeHTML(t)}</span>`;
            tagList.appendChild(el);
        });

        /* 人数・時間 */
        document.getElementById("recipe-people").textContent = recipe.people || "-";

        const totalMinutes = Number(recipe.time || 0);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        document.getElementById("recipe-time").textContent = `${hour}時間 ${minute}分`;

        /* 材料 */
        renderCategories(recipe.categories || []);

        /* 下ごしらえ */
        renderSteps("preparation-list", recipe.preparations || [], false);

        /* 手順 */
        renderSteps("step-list", recipe.steps || [], true);

        /* 補足 */
        const supplementBlock = document.getElementById("supplement-block");
        const supplementText = document.getElementById("supplement-text");

        if (recipe.supplement) {
            supplementText.textContent = recipe.supplement;
            supplementBlock.style.display = "block";
        } else {
            supplementBlock.style.display = "none";
        }
    }

    function renderCategories(categories){

        const list = document.getElementById("category-list");
        list.innerHTML = "";

        if (categories.length === 0) {
            list.innerHTML = `<p style="font-size:14px;color:#999;">材料は登録されていません</p>`;
            return;
        }

        categories.forEach(cat => {

            const block = document.createElement("div");
            block.className = "view-category-block";

            let html = `<div class="view-category-name">${escapeHTML(cat.name || "無題カテゴリ")}</div>`;

            (cat.groups || []).forEach(group => {

                html += `<div class="view-ingredient-group">`;

                group.forEach((item, index) => {
                    if (index > 0) {
                        html += `<div class="view-or-label">または</div>`;
                    }
                    html += `
                        <div class="view-ingredient-line">
                            <span class="view-ingredient-name">${escapeHTML(item.name || "")}</span>
                            <span class="view-ingredient-amount">${escapeHTML(item.amount || "")}</span>
                        </div>
                    `;
                });

                html += `</div>`;
            });

            block.innerHTML = html;
            list.appendChild(block);
        });
    }

    function renderSteps(containerId, items, numbered){

        const list = document.getElementById(containerId);
        list.innerHTML = "";

        if (items.length === 0) {
            list.innerHTML = `<p style="font-size:14px;color:#999;">登録されていません</p>`;
            return;
        }

        items.forEach((item, index) => {

            const row = document.createElement("div");
            row.className = "view-step-row";

            const numberHTML = numbered
                ? `<div class="view-step-number">${index + 1}.</div>`
                : "";

            const imageHTML = item.image
                ? `<img class="view-step-image" src="${item.image}" alt="">`
                : "";

            row.innerHTML = `
                ${numberHTML}
                <div class="view-step-content">
                    <div class="view-step-text">${escapeHTML(item.text || "")}</div>
                    ${imageHTML}
                </div>
            `;

            list.appendChild(row);
        });
    }

    /* ===========================
       XSS対策（表示前のエスケープ）
    =========================== */

    function escapeHTML(str){
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===========================
       編集・削除・共有（ローカル表示のときだけ有効）
    =========================== */

    if (!isSharedView) {

        /* 編集ボタン（他人由来のレシピは編集不可） */
        if (currentRecipe.isImported) {
            document.getElementById("edit-btn").style.display = "none";
        } else {
            document.getElementById("edit-btn").addEventListener("click", () => {
                window.location.href = `create.html?id=${currentId}`;
            });
        }

        /* 削除ボタン・モーダル */
        const deleteBtn = document.getElementById("delete-btn");
        const deleteModal = document.getElementById("delete-modal");
        const deleteCancel = document.getElementById("delete-cancel");
        const deleteOk = document.getElementById("delete-ok");

        deleteBtn.addEventListener("click", () => {
            deleteModal.classList.add("show");
        });

        deleteCancel.addEventListener("click", () => {
            deleteModal.classList.remove("show");
        });

        deleteOk.addEventListener("click", async () => {
            await deleteRecipeById(currentId);
            window.location.href = "index.html";
        });

        /* ===========================
           共有ボタン
        =========================== */

        const shareBtn = document.getElementById("share-btn");
        const shareModal = document.getElementById("share-modal");
        const shareOk = document.getElementById("share-ok");
        const shareMessage = document.getElementById("share-message");
        const shareUrlBox = document.getElementById("share-url-box");
        const shareXBtn = document.getElementById("share-x-btn");
        const shareUrlInput = document.getElementById("share-url-input");
        const shareCopyBtn = document.getElementById("share-copy-btn");

        shareBtn.addEventListener("click", async () => {

            shareBtn.disabled = true;
            const originalLabel = shareBtn.textContent;
            shareBtn.textContent = "アップロード中...";

            try {
                const user = await ensureSignedIn();

                const count = await getShareCount(user.id);

                if (count >= SHARE_LIMIT) {
                    shareMessage.textContent = `共有できる件数（${SHARE_LIMIT}件）の上限に達しました`;
                    shareUrlBox.style.display = "none";
                    shareModal.classList.add("show");
                    return;
                }

                const recipeForShare = await uploadRecipeImages(currentRecipe, user.id);

                const { data: inserted, error: insertError } = await window.supabase
                    .from("shared_recipes")
                    .insert({
                        owner_id: user.id,
                        recipe_data: recipeForShare
                    })
                    .select("id")
                    .single();

                if (insertError || !inserted) {
                    throw insertError || new Error("共有に失敗しました");
                }

                await incrementShareCount(user.id, count);

                const shareUrl = `${window.location.origin}${window.location.pathname.replace("view.html", "")}view.html?share=${inserted.id}`;

                const shareText = `「${currentRecipe.title}」のレシピを共有しました🍳 #れぴこ #Repico`;
                const xIntentUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

                shareXBtn.href = xIntentUrl;
                shareXBtn.style.display = "inline-block";

                shareMessage.textContent = "共有リンクを発行しました";
                shareUrlInput.value = shareUrl;
                shareUrlBox.style.display = "flex";
                shareModal.classList.add("show");

            } catch (err) {
                console.error(err);
                shareMessage.textContent = "共有に失敗しました。時間をおいて再度お試しください";
                shareUrlBox.style.display = "none";
                shareModal.classList.add("show");

            } finally {
                shareBtn.disabled = false;
                shareBtn.textContent = originalLabel;
            }
        });

        shareOk.addEventListener("click", () => {
            shareModal.classList.remove("show");
        });

        shareCopyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(shareUrlInput.value);
                shareCopyBtn.textContent = "コピー済み";
                setTimeout(() => { shareCopyBtn.textContent = "コピー"; }, 1500);
            } catch (err) {
                shareUrlInput.select();
            }
        });
    }

    /* ===========================
      共有ビュー：このレシピを保存（確認＋完了モーダル）
     =========================== */

    if (isSharedView) {
      const saveSharedBtn = document.getElementById("save-shared-btn");

      const saveModal = document.getElementById("save-modal");
      const saveCancel = document.getElementById("save-cancel");
      const saveOk = document.getElementById("save-ok");

      const saveSuccessModal = document.getElementById("save-success-modal");
      const saveSuccessOk = document.getElementById("save-success-ok");

      // 保存ボタン -> 確認モーダルを開く
      saveSharedBtn.addEventListener("click", () => {
        saveModal.classList.add("show");
      });

      // キャンセル -> 確認モーダルを閉じる
      saveCancel.addEventListener("click", () => {
        saveModal.classList.remove("show");
      });

      // OK -> 保存実行 -> 保存完了モーダル表示
      saveOk.addEventListener("click", async () => {
        saveModal.classList.remove("show");

        saveOk.disabled = true;
        const originalLabel = saveOk.textContent;
        saveOk.textContent = "保存中...";

        try {
          const recipeToSave = {
            ...currentRecipe,
            isImported: true,
            createdAt: Date.now()
          };

          delete recipeToSave.id;

          await saveRecipe(recipeToSave);

          saveSuccessModal.classList.add("show");

        } catch (err) {
          console.error(err);
          alert("保存に失敗しました。時間をおいて再度お試しください");
          saveOk.disabled = false;
          saveOk.textContent = originalLabel;
        }
      });

      // 保存完了モーダルのOK -> index.htmlへ遷移
      saveSuccessOk.addEventListener("click", () => {
        saveSuccessModal.classList.remove("show");
        window.location.href = "index.html";
      });
    }

    /* ===========================
       Supabase：匿名ログイン
    =========================== */

    async function ensureSignedIn(){
        const { data: { user: existingUser } } = await window.supabase.auth.getUser();
        if (existingUser) return existingUser;

        const { data, error } = await window.supabase.auth.signInAnonymously();
        if (error) throw error;

        return data.user;
    }

    /* ===========================
       Supabase：共有件数の取得・更新
    =========================== */

    async function getShareCount(userId){
        const { data, error } = await window.supabase
            .from("user_share_counts")
            .select("shared_count")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;

        return data ? data.shared_count : 0;
    }

    async function incrementShareCount(userId, currentCount){
        const { error } = await window.supabase
            .from("user_share_counts")
            .upsert({ user_id: userId, shared_count: currentCount + 1 });

        if (error) throw error;
    }

    /* ===========================
       Supabase：画像アップロード
    =========================== */

    async function dataURLToBlob(dataUrl){
        const res = await fetch(dataUrl);
        return await res.blob();
    }

    async function uploadImageIfNeeded(imageDataUrl, userId){
        if (!imageDataUrl) return null;

        /* 既にアップロード済み（httpから始まる）ならそのまま使う */
        if (imageDataUrl.startsWith("http")) return imageDataUrl;

        const blob = await dataURLToBlob(imageDataUrl);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;

        const { error } = await window.supabase.storage
            .from("recipe-images")
            .upload(path, blob, { contentType: "image/jpeg" });

        if (error) throw error;

        const { data } = window.supabase.storage
            .from("recipe-images")
            .getPublicUrl(path);

        return data.publicUrl;
    }

    async function uploadRecipeImages(recipe, userId){

        const cloned = JSON.parse(JSON.stringify(recipe));
        delete cloned.id; // ローカルの自分のIDを共有データに含めない

        cloned.image = await uploadImageIfNeeded(cloned.image, userId);

        for (const prep of cloned.preparations || []) {
            prep.image = await uploadImageIfNeeded(prep.image, userId);
        }

        for (const step of cloned.steps || []) {
            step.image = await uploadImageIfNeeded(step.image, userId);
        }

        return cloned;
    }

});