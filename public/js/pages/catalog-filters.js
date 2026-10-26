const SORTS = {
    featured: null,
    'name-asc': (a,b) => a.name.localeCompare(b.name),
    'name-desc': (a,b) => b.name.localeCompare(a.name),
    'price-asc': (a,b) => Number(a.price) - Number(b.price),
    'price-desc': (a,b) => Number(b.price) - Number(a.price)
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function setupFilters(app, products){
    const grid = app.querySelector('.grid');
    const heading = app.querySelector('h1');
    if (!grid || !heading) return;
    const productById = new Map(products.map((p) => [Number(p.product_id), p]));
    const entries = [...grid.querySelectorAll('.product-card')].map((card, index) => {
        const id = Number(card.querySelector('.product-cart-controls').dataset.productId);
        const product = productById.get(id);
        return {
        card,
        product,
        index,
        searchText: [product.name, product.description, product.cetagory]
            .join(' ')
            .toLowerCase()
        };
    });

    const categories = [...new Set(products.map((p) => p.category))].sort();

    const toolbar = document.createElement('div');
    toolbar.className = 'catalog-toolbar';
    toolbar.innerHTML = `
        <input
        id="catalog-search"
        class="catalog-search"
        type="search"
        placeholder="Search our organic products"
        aria-label="Search products"
        >
        <select id="catalog-sort" class="catalog-sort" aria-label="Sort products">
        <option value="featured">Featured</option>
        <option value="name-asc">Name: A to Z</option>
        <option value="name-desc">Name: Z to A</option>
        <option value="price-asc">Price: Low to high</option>
        <option value="price-desc">Price: High to low</option>
        </select>
        <button
        id="filter-toggle"
        class="button small filter-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="catalog-filters"
        >Filters</button>
    `;
    const sidebar = document.createElement('aside');
    sidebar.id = 'catalog-filters';
    sidebar.className = 'catalog-filters card';
    sidebar.innerHTML = `
        <div class="card-content">
        <h2>Availability</h2>
        <label class="filter-option">
            <input type="checkbox" id="in-stock-only"> In stock only
        </label>

        <h2>Type of Food</h2>
        ${categories.map((category) => `
            <label class="filter-option">
            <input type="checkbox" class="category-filter" value="${escapeHtml(category)}">
            ${escapeHtml(category)}
            </label>
        `).join('')}

        <button id="clear-filters" class="button small" type="button">Clear filters</button>
        </div>
    `;
    const noResults = document.createElement('p');
    noResults.className = 'muted';
    noResults.textContent = 'No products match your search or filters.';
    noResults.hidden = true;

    const layout = document.createElement('div');
    layout.className = 'catalog-layout';
    const main = document.createElement('div');

    grid.replaceWith(layout);
    main.append(noResults, grid);
    layout.append(sidebar, main);
    heading.after(toolbar);

    const searchInput = toolbar.querySelector('#catalog-search');
    const sortSelect = toolbar.querySelector('#catalog-sort');
    const toggle = toolbar.querySelector('#filter-toggle');
    const inStockBox = sidebar.querySelector('#in-stock-only');
    const categoryBoxes = [...sidebar.querySelectorAll('.category-filter')];

    function update() {
        const query = searchInput.value.trim().toLowerCase();
        const inStockOnly = inStockBox.checked;
        const selected = categoryBoxes.filter((b) => b.checked).map((b) => b.value);
        const sorter = SORTS[sortSelect.value];

        const ordered = [...entries].sort(
        sorter
            ? (a, b) => sorter(a.product, b.product)
            : (a, b) => a.index - b.index
        );

        let visible = 0;

        for (const { card, product, searchText } of ordered) {
        const matches =
            searchText.includes(query) &&
            (!inStockOnly || Number(product.quantity) > 0) &&
            (selected.length === 0 || selected.includes(product.category));

        card.hidden = !matches;
        grid.append(card);
        if (matches) visible++;
        }

        noResults.hidden = visible > 0;
    }

    searchInput.addEventListener('input', update);
    sortSelect.addEventListener('change', update);
    inStockBox.addEventListener('change', update);
    categoryBoxes.forEach((box) => box.addEventListener('change', update));

    sidebar.querySelector('#clear-filters').addEventListener('click', () => {
        inStockBox.checked = false;
        categoryBoxes.forEach((box) => { box.checked = false; });
        update();
    });

    function setOpen(open) {
        sidebar.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', () => {
        setOpen(!sidebar.classList.contains('open'));
    });

    document.addEventListener('click', (event) => {
        if (
        sidebar.classList.contains('open') &&
        !sidebar.contains(event.target) &&
        !toggle.contains(event.target)
        ) {
        setOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOpen(false);
    });
}


