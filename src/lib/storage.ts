// Acesso tolerante ao localStorage: em janelas privadas, prévias ou ambientes que bloqueiam o
// armazenamento, os dados ficam em memória durante a sessão e o app continua funcionando.
const memory = new Map<string, string>()

function local(): Storage | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      const v = local()?.getItem(key)
      if (v !== null && v !== undefined) return v
    } catch {
      /* armazenamento bloqueado */
    }
    return memory.get(key) ?? null
  },
  /** Lança erro apenas quando o armazenamento está cheio (o chamador decide como avisar). */
  set(key: string, value: string) {
    memory.set(key, value)
    try {
      local()?.setItem(key, value)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw e
    }
  },
  remove(key: string) {
    memory.delete(key)
    try {
      local()?.removeItem(key)
    } catch {
      /* armazenamento bloqueado */
    }
  },
}
