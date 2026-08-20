// services/usersService.js

import apiClient from "./apiClient";

export async function getUsers() {
  const response = await apiClient.get("/users");
  return response.data;
}

export async function addUser(username, password, role) {
  const response = await apiClient.post("/users", {
    username,
    password,
    role,
  });

  return response.data;
}

export async function updateUser(id, username, password = null) {
  const response = await apiClient.put(`/users/${id}`, {
    username,
    password: password?.trim() || null,
  });

  return response.data;
}

export async function deleteUser(id) {
  const response = await apiClient.delete(`/users/${id}`);
  return response.data;
}