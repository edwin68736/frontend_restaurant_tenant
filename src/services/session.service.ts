import api from './api'

export type BranchBrief = {
  id: number
  name: string
  is_main?: boolean
}

export type SessionContextResponse = {
  active_branch: BranchBrief | null
  can_switch_branch: boolean
  allowed_branches?: BranchBrief[]
}

export type SwitchBranchResponse = {
  token: string
  /** Si el backend lo envía (hoy no) se guarda; Tukichef no usa refresh token. */
  refresh_token?: string
  active_branch: BranchBrief
  can_switch_branch: boolean
  allowed_branches?: BranchBrief[]
  permissions?: string[]
  restaurant_permissions?: string[]
}

export const sessionService = {
  getContext: () => api.get<SessionContextResponse>('/api/session/context').then((r) => r.data),

  switchBranch: (branchId: number) =>
    api
      .post<SwitchBranchResponse>('/api/session/switch-branch', { branch_id: branchId })
      .then((r) => r.data),
}
