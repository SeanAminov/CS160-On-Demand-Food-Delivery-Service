// The buttons at the top of the employee pages

const EMPLOYEE_PAGES = [
  { href: '#/employee', label: 'Dashboard' },
  { href: '#/employee-packing', label: 'Orders to Pack' },
  { href: '#/employee-shipping', label: 'Waiting to Ship' },
  { href: '#/employee-inventory', label: 'Inventory' },
];

export function employeeNavigation(currentPage) {
  return `
    <nav class="buttons employee-navigation">
      ${EMPLOYEE_PAGES.map((page) => `
        <a class="button${page.href === currentPage ? ' primary' : ''}" href="${page.href}">
          ${page.label}
        </a>
      `).join('')}
    </nav>
  `;
}
