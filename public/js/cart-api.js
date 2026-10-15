// Shared helpers for the cart. The session cookie tells the server who is logged in.

export async function cartRequest(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
