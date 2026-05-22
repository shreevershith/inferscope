export class ApiClientError extends Error {
  constructor(message, { status = 0, source = 'unknown', cause } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.source = source
    if (cause) this.cause = cause
  }
}
