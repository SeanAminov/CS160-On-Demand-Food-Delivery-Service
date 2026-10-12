// TODO: filter by category (fruits, vegetables, pantry)
// TODO: make Add to Cart work

export default {
  title: 'Shop',
  async show(app) {
    const response = await fetch('/products');
    const products = await response.json();

    if (products.length === 0) {
      app.innerHTML = '<h1>Shop</h1><p class="muted">No products yet.</p>';
      return;
    }

    let cards = '';
    for (const product of products) {
      cards += `
        <div class="card">
          <h2>${product.name}</h2>
          <p class="muted">${product.description}</p>
          <p class="price">$${Number(product.price).toFixed(2)}, ${product.weight} lb</p>
          <button class="button primary" disabled>Add to Cart</button>
        </div>
      `;
    }

    app.innerHTML = `<h1>Shop</h1><div class="grid">${cards}</div>`;
  },
};
