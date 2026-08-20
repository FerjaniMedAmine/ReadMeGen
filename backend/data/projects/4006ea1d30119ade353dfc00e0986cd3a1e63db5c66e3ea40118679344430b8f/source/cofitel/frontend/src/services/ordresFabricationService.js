// services/ordresFabricationService.js
import apiClient from "./apiClient";


export async function getOrdresFabrication() {
  const response = await apiClient.get("/ordres-fabrication");
  return response.data;
}


export async function getOrdreFabrication(numeroOf) {
  const response = await apiClient.get(`/ordres-fabrication/${numeroOf}`);
  return response.data;
}


export async function addOrdreFabrication(numeroOf, referenceProduit, quantite, siteId) {
  const response = await apiClient.post("/ordres-fabrication", {
    numero_of: numeroOf,
    reference_produit: referenceProduit,
    quantite,
    site_id: siteId,
  });

  return response.data;
}


export async function updateOrdreFabrication(numeroOf, referenceProduit, quantite, siteId) {
  const response = await apiClient.put(`/ordres-fabrication/${numeroOf}`, {
    reference_produit: referenceProduit,
    quantite,
    site_id: siteId,
  });

  return response.data;
}