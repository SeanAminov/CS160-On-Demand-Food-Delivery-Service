// Asks the server who is logged in. Returns null if nobody is.
export async function getUser() {
  try {
    const response = await fetch('/profile');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}
