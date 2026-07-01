console.log("Repico v0.1.2");

const recipes = [
    {
        title: "オムライス",
        people: 2,
        time: "30分",
        tags: ["洋食", "卵", "簡単"],
        thumb: ""
    },
    {
        title: "チャーハン",
        people: 1,
        time: "10分",
        tags: ["中華", "時短"],
        thumb: ""
    }
];

const list = document.querySelector(".recipe-list");

function renderRecipes(){

    list.innerHTML = "";

    recipes.forEach(r => {

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
}

renderRecipes();
