import axios from "axios";
import API_URL from "../config/api";


export async function login(username, password) {
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: username.trim(),
    password,
  });

  return response.data;
}
export function logout() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("user");
}