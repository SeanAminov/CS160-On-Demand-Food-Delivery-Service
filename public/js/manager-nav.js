// The buttons at the top of the manager pages
const MANAGER_PAGES = [
  ['#/manager', 'Manager Dashboard'],
  ['#/manager-inventory', 'Products and Inventory'],
  ['#/manager-orders', 'Order Management'],
  ['#/manager-transactions', 'Transaction History'],
];

export function managerNavigation(currentPage) {
  const links = MANAGER_PAGES.map(
    ([page, label]) => `
      <a class="button ${page === currentPage ? 'primary' : ''}" href="${page}">
        ${label}
      </a>
    `
  ).join('');

  return `<nav class="buttons manager-navigation">${links}</nav>`;
}
