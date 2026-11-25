/*
  Access token chỉ nằm trong BỘ NHỚ của tab, refresh token nằm trong cookie
  HttpOnly do server đặt - không cái nào nằm trong localStorage nữa. Script
  lọt vào trang (XSS) không đọc được cookie HttpOnly, nên không lấy trộm được
  phiên dài hạn mang đi dùng ở máy khác.

  Tải lại trang là mất access token trong bộ nhớ: AuthProvider gọi làm mới
  (trình duyệt tự gửi cookie) để lấy lại.
*/

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearTokens() {
  accessToken = null;
}
