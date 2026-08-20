import apiClient from "./apiClient";


export async function getDefautsDetectes({
  sessionId,
  numeroOf,
  referenceProduit,
} = {}) {
  const params = {};

  if (sessionId) params.session_id = sessionId;
  if (numeroOf) params.numero_of = numeroOf;
  if (referenceProduit) {
    params.reference_produit = referenceProduit;
  }

  const response = await apiClient.get(
    "/defauts-detectes",
    { params }
  );

  return response.data;
}


export async function getDefautDetecte(id) {
  const response = await apiClient.get(
    `/defauts-detectes/${id}`
  );

  return response.data;
}


export async function getDefautsDetectesStats({
  sessionId,
  numeroOf,
  referenceProduit,
} = {}) {
  const params = {};

  if (sessionId) params.session_id = sessionId;
  if (numeroOf) params.numero_of = numeroOf;
  if (referenceProduit) {
    params.reference_produit = referenceProduit;
  }

  const response = await apiClient.get(
    "/defauts-detectes/stats",
    { params }
  );

  return response.data;
}


export async function addDefautDetecte({
  sessionId,
  codeErreurId,
  repereTopo,
  coefficient,
  observation,
  numeroProduit,
}) {
  const response = await apiClient.post(
    "/defauts-detectes",
    {
      session_id: sessionId,
      code_erreur_id: codeErreurId,
      repere_topo: repereTopo,
      coefficient,
      observation: observation || null,
      numero_produit: numeroProduit,
    }
  );

  return response.data;
}