import api from './api'

export type BranchBrief = {
  id: number
  name: string
  is_main?: boolean
}

export const sessionService = {
  getContext: () =>
    api
      .get<{
        active_branch: BranchBrief | null
        can_switch_branch: boolean
        allowed_branches?: BranchBrief[]
      }>('/api/session/context')
      .then((r) => r.data),

  switchBranch: (branchId: number) =>
    api
      .post<{
        token: string
        active_branch: BranchBrief
        can_switch_branch: boolean
        allowed_branches?: BranchBrief[]
      }>('/api/session/switch-branch', { branch_id: branchId })
      .then((r) => r.data),
}
