export type ApiSuccess<T> = {
  data: T
  error: null
  meta?: ApiMeta
}

export type ApiFailure = {
  data: null
  error: ApiError
  meta?: ApiMeta
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type ApiError = {
  code: string
  message: string
  details?: Record<string, string | number | boolean | null>
}

export type ApiMeta = {
  requestId?: string
  page?: number
  pageSize?: number
  total?: number
}

export type PaginationParams = {
  page?: number
  pageSize?: number
}
