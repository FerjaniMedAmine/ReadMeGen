import apiClient from "./apiClient";


export async function getSites() {
  const response = await apiClient.get("/sites");
  return response.data;
}
