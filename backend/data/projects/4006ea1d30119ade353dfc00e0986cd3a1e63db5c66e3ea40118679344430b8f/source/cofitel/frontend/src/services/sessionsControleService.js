import apiClient from "./apiClient";


export async function getSessionsControle() {
  const response = await apiClient.get(
    "/sessions-controle"
  );

  return response.data;
}


export async function getSessionControle(sessionId) {
  const response = await apiClient.get(
    `/sessions-controle/${sessionId}`
  );

  return response.data;
}


export async function addSessionControle({
  numeroOf,
  operateurId,
  ilotId,
  posteDetectionId,
}) {
  const response = await apiClient.post(
    "/sessions-controle",
    {
      numero_of: numeroOf,
      operateur_id: operateurId,
      ilot_id: ilotId,
      poste_detection_id: posteDetectionId,
    }
  );

  return response.data;
}

export async function cloturerSessionControle({
  sessionId,
  quantiteControlee,
}) {
  const response = await apiClient.patch(
    `/sessions-controle/${sessionId}/cloture`,
    {
      quantite_controlee: quantiteControlee,
    }
  );

  return response.data;
}