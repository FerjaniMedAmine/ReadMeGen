const WORK_CONTEXT_KEY = "work_context";


export function getWorkContext() {
  const storedContext = localStorage.getItem(WORK_CONTEXT_KEY);

  if (!storedContext) {
    return null;
  }

  try {
    const context = JSON.parse(storedContext);

    if (
      !context.site ||
      !context.client ||
      !context.machine ||
      !context.referenceCarte
    ) {
      return null;
    }

    return {
      site: context.site,
      client: context.client,
      machine: context.machine,
      referenceCarte: context.referenceCarte,
    };
  } catch {
    localStorage.removeItem(WORK_CONTEXT_KEY);
    return null;
  }
}


export function saveWorkContext(context) {
  const normalizedContext = {
    site: context.site.trim(),
    client: context.client.trim(),
    machine: context.machine.trim(),
    referenceCarte: context.referenceCarte.trim(),
  };

  localStorage.setItem(
    WORK_CONTEXT_KEY,
    JSON.stringify(normalizedContext)
  );

  return normalizedContext;
}


export function clearWorkContext() {
  localStorage.removeItem(WORK_CONTEXT_KEY);
}


export function hasValidWorkContext() {
  return getWorkContext() !== null;
}