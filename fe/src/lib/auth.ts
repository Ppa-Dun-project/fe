export const TOKEN_KEY = "ppadun_token";

export function isAuthed(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function mockLogin(): void {
  localStorage.setItem(TOKEN_KEY, "mock-token");
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}


// Will be substitute into login API call in the future