/** Layout 4 columnas: Cant. | Descripción | P.U. | Importe */

export type TicketDetail4ColLayout = {
  innerW: number
  xCant: number
  wCant: number
  xDesc: number
  wDescFirst: number
  wDescCont: number
  xEndPUnit: number
  xEndImporte: number
  wMoney: number
  gap: number
}

export function ticketDetailLayout4Col(options: {
  pageW: number
  margin: number
  wMoneyMm?: number
  wCantMm?: number
}): TicketDetail4ColLayout {
  const { pageW, margin } = options
  const narrow = pageW <= 62
  const gap = 1
  const wMoney = options.wMoneyMm ?? (narrow ? 11 : 16)
  const wCant = options.wCantMm ?? (narrow ? 7 : 9)
  const innerW = pageW - 2 * margin
  const xEndImporte = pageW - margin
  const xEndPUnit = xEndImporte - wMoney - gap
  const xCant = margin
  const xDesc = xCant + wCant + gap
  const wDescFirst = Math.max(10, xEndPUnit - gap - xDesc)
  const wDescCont = xEndImporte - xDesc

  return {
    innerW,
    xCant,
    wCant,
    xDesc,
    wDescFirst,
    wDescCont,
    xEndPUnit,
    xEndImporte,
    wMoney,
    gap,
  }
}
