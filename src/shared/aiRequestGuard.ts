/** 仅当该 requestId 仍是当前请求时才把 AI 结果写回画布或对话。 */
export function shouldApplyAiResult(activeRequestId: string | null | undefined, requestId: string): boolean {
  return !!requestId && activeRequestId === requestId
}
