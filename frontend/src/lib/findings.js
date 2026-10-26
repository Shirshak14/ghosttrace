// Applies an updated finding to a list. A triage change (sameSecret) also covers every other copy of the same secret.
export const applyUpdate = (f, sameSecret = true) => (x) => (x.id === f.id ? f : sameSecret && x.fingerprint === f.fingerprint ? { ...x, status: f.status } : x)
