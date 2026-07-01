const recipes = [
    {
        title: "オムライス",
        people: 2,
        time: "30分",
        tags: ["洋食", "卵", "簡単"]
    },
    {
        title: "チャーハン",
        people: 1,
        time: "10分",
        tags: ["中華", "時短"]
    },
    {
        title: "味噌汁",
        people: 2,
        time: "5分",
        tags: ["和食", "簡単"]
    }
];

const list = document.querySelector(".recipe-list");
const searchInput = document.querySelector(".search-input");
const countEl = document.getElementById("recipe-count-number");

let filtered = [...recipes];

function renderRecipes(data){

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

    // 件数更新
    countEl.textContent = data.length;
}

function filterRecipes(keyword){

    if(!keyword){
        filtered = [...recipes];
    } else {
        filtered = recipes.filter(r =>
            r.title.includes(keyword) ||
            r.tags.some(t => t.includes(keyword))
        );
    }

    renderRecipes(filtered);
}

// 検索イベント
searchInput.addEventListener("input", (e) => {
    filterRecipes(e.target.value);
});

// 初期表示
renderRecipes(recipes);

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
}
