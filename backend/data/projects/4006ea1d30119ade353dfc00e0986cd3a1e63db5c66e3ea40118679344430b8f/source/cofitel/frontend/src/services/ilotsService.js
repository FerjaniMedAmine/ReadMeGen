import apiClient from "./apiClient";


export async function getIlots() {
  const response = await apiClient.get("/ilots");
  return response.data;
}


export async function getIlot(id) {
  const response = await apiClient.get(`/ilots/${id}`);
  return response.data;
}


export async function addIlot(name) {
  const response = await apiClient.post("/ilots", {
    name,
  });

  return response.data;
}


export async function updateIlot(id, name) {
  const response = await apiClient.put(`/ilots/${id}`, {
    name,
  });

  return response.data;
}


export async function deleteIlot(id) {
  const response = await apiClient.delete(`/ilots/${id}`);
  return response.data;
}
