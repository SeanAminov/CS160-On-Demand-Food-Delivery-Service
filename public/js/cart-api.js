// Shared helpers for the cart. Login saves the user here until we have sessions.

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

export async function cartRequest(method, url, body) {
  const user = getUser();
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': user ? user.user_id : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

export function money(amount) {
  return '$' + Number(amount).toFixed(2);
}
