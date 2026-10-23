// Testes de aceitação ponta a ponta (modo local). Requer o app em http://localhost:5173 (npm run dev).
// Uso: npm run e2e
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = process.env.SHOTS_DIR || '.'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()))
const results = []
const check = async (name, fn) => {
  try {
    await fn()
    results.push(['OK  ', name])
  } catch (e) {
    results.push(['FAIL', `${name} → ${e.message.split('\n')[0]}`])
    await page.screenshot({ path: `${OUT}/fail-${results.length}.png`, fullPage: true }).catch(() => {})
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }
const login = async (email, pass) => {
  await page.goto(BASE + '/')
  if (await page.locator('button[title="Sair"]').count()) { await page.click('button[title="Sair"]'); await page.waitForTimeout(300) }
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', pass)
  await page.click('button[type=submit]')
  await page.waitForSelector('h1:has-text("Visão Geral")', { timeout: 8000 })
  await page.waitForTimeout(600)
}
const confirmDialog = async (label) => { await page.locator('[role=dialog] button', { hasText: label }).last().click(); await page.waitForTimeout(500) }
const progressText = async () => (await page.locator('text=Progresso da jornada').locator('..').locator('..').innerText())

// Ambiente limpo
await page.goto(BASE)
await page.waitForLoadState('networkidle')
await page.evaluate(() => localStorage.clear())

await check('Login do administrador e Cockpit com projeto Jantar Empresarial', async () => {
  await login('admin@launchos.demo', 'admin123')
  await page.waitForSelector('h2:has-text("Rafael Martins")')
})

let jantarUrl = ''
await check('1. Admin cria expert e projeto', async () => {
  await page.goto(BASE + '/configuracoes?aba=experts')
  await page.click('button:has-text("Novo expert")')
  await page.locator('[role=dialog] input:visible').nth(0).fill('Expert Teste E2E')
  await confirmDialog('Salvar')
  await page.waitForSelector('text=Expert Teste E2E >> visible=true')
  await page.goto(BASE + '/projetos')
  await page.click('button:has-text("Novo projeto")')
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('input:visible').first().fill('Projeto E2E')
  await dlg.locator('select').first().selectOption({ label: 'Expert Teste E2E' })
  await confirmDialog('Criar projeto')
  await page.waitForURL(/\/projetos\/.+/)
  await page.waitForSelector('h1:has-text("Projeto E2E")')
})

await check('2–5. Escada: 25% inicial, concluir V3 → 37,5%, persiste após recarregar', async () => {
  await page.goto(BASE + '/projetos')
  await page.click('h3:has-text("Jantar Empresarial — Lançamento")')
  await page.waitForURL(/\/projetos\/.+/)
  jantarUrl = page.url().split('?')[0]
  await page.goto(jantarUrl + '?aba=fases')
  await page.waitForSelector('text=Progresso da jornada >> visible=true')
  expect((await progressText()).includes('25%'), 'progresso inicial não é 25%')
  await page.locator('svg [aria-label^="V3 Funis"]').click()
  await page.click('button:has-text("Marcar como concluída")')
  await confirmDialog('Marcar como concluída')
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  expect((await progressText()).includes('37,5%'), 'progresso não foi para 37,5%')
  await page.reload()
  await page.waitForSelector('text=Progresso da jornada >> visible=true')
  expect((await progressText()).includes('37,5%'), 'progresso não persistiu')
  expect(await page.locator('text=V4 — Geração de Receitas').count(), 'fase atual não avançou para V4')
})

await check('7–8. Movimento com imagem vinculado a projeto abre o projeto correto', async () => {
  await page.goto(BASE + '/posicionamento')
  await page.click('button:has-text("Novo movimento")')
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('input:visible').first().fill('Movimento E2E')
  await dlg.locator('input[type=file]').setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') })
  await page.locator('button:has-text("Aplicar recorte")').click()
  await page.waitForTimeout(800)
  await dlg.locator('select').nth(0).selectOption({ label: 'Jantar Empresarial — Lançamento' })
  await dlg.locator('select').nth(1).selectOption('publicado')
  await confirmDialog('Salvar')
  await page.click('button[aria-label="Abrir Movimento E2E"]')
  await page.waitForURL(/\/projetos\/.+/)
  expect(page.url().split('?')[0] === jantarUrl, 'abriu projeto errado')
  await page.waitForSelector('h1:has-text("Jantar Empresarial — Lançamento")')
})

await check('9. Página: cadastrar, editar URL e alterar status', async () => {
  await page.goto(BASE + '/paginas')
  await page.click('button:has-text("Nova página")')
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('input:visible').nth(0).fill('Página E2E')
  await dlg.locator('input[placeholder="https://"]').first().fill('https://exemplo.com/e2e')
  await confirmDialog('Salvar')
  await page.waitForSelector('text=Página E2E >> visible=true')
  const card = page.locator('.card', { hasText: 'Página E2E' })
  await card.locator('button[aria-label="Editar"]').click()
  await dlg.locator('input[placeholder="https://"]').first().fill('https://exemplo.com/e2e-v2')
  await confirmDialog('Salvar')
  await card.locator('select').selectOption('publicada')
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForSelector('text=Página E2E >> visible=true')
  const c2 = page.locator('.card', { hasText: 'Página E2E' })
  expect(await c2.locator('a[href="https://exemplo.com/e2e-v2"]').count(), 'URL não atualizada')
  expect((await c2.locator('select').inputValue()) === 'publicada', 'status não persistiu')
})

await check('10–11. Filtros de tráfego alteram investimento; ordenações diferem', async () => {
  await page.goto(BASE + '/trafego')
  await page.waitForSelector('text=Investimento total no período >> visible=true')
  const total = async () => (await page.locator('text=Investimento total no período').locator('..').locator('div').nth(1).innerText())
  const t30 = await total()
  await page.locator('select[aria-label="Campanha"]').selectOption({ index: 2 })
  await page.waitForTimeout(300)
  const tCamp = await total()
  expect(t30 !== tCamp, `total não mudou com filtro (${t30})`)
  await page.locator('select[aria-label="Campanha"]').selectOption('all')
  await page.click('button:has-text("Últimos 30 dias")')
  await page.click('button:has-text("Últimos 7 dias")')
  await page.waitForTimeout(300)
  expect((await total()) !== t30, 'total não mudou com período')
  const firstAd = async () => page.locator('.card h4').first().innerText()
  const order = {}
  for (const k of ['leads', 'ctr', 'clicks']) { await page.locator('select[aria-label="Ordenar anúncios"]').selectOption(k); await page.waitForTimeout(200); order[k] = await firstAd() }
  expect(new Set(Object.values(order)).size >= 2, `ordenações iguais: ${JSON.stringify(order)}`)
})

await check('15. Exclusão de projeto com vendas é bloqueada e oferece arquivamento', async () => {
  await page.goto(jantarUrl)
  await page.click('button[aria-label="Ações do projeto"]')
  await page.click('button:has-text("Excluir")')
  await page.waitForSelector('text=Exclusão bloqueada >> visible=true')
  await page.locator('[role=dialog] button', { hasText: 'Cancelar' }).click()
})

await check('15b. Exclusão de projeto sem dependências exige digitar o nome', async () => {
  await page.goto(BASE + '/projetos')
  await page.click('h3:has-text("Projeto E2E")')
  await page.waitForURL(/\/projetos\/.+/)
  await page.waitForSelector('h1:has-text("Projeto E2E")')
  await page.click('button[aria-label="Ações do projeto"]')
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  const btn = page.locator('[role=dialog] button', { hasText: 'Excluir projeto' })
  expect(await btn.isDisabled(), 'botão deveria exigir confirmação digitada')
  await page.locator('[role=dialog] input').fill('Projeto E2E')
  await btn.click()
  await page.waitForURL(BASE + '/projetos')
  await page.waitForTimeout(400)
  expect(!(await page.locator('h3:has-text("Projeto E2E")').count()), 'projeto não foi excluído')
})

await check('16. Nova seção gera telas funcionais de cadastro e edição', async () => {
  await page.goto(BASE + '/configuracoes?aba=secoes')
  await page.click('button:has-text("Nova seção")')
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('input:visible').first().fill('Fornecedores E2E')
  await dlg.locator('button:has-text("Adicionar campo")').click()
  const second = dlg.locator('[data-field-row]').nth(1)
  await second.locator('input:visible').first().fill('Valor')
  await second.locator('select').selectOption('currency')
  await confirmDialog('Salvar seção')
  await page.click('aside nav a:has-text("Fornecedores E2E")')
  await page.waitForURL(/\/secoes\/fornecedores_e2e/)
  await page.click('button:has-text("Novo registro")')
  await confirmDialog('Salvar')
  expect(await page.locator('text=Nome é obrigatório').count(), 'validação de obrigatório ausente')
  await dlg.locator('input:visible').first().fill('Fornecedor A')
  await dlg.locator('input[inputmode=decimal]').fill('1.500,00')
  await confirmDialog('Salvar')
  await page.waitForSelector('text=Fornecedor A >> visible=true')
  await page.locator('.card', { hasText: 'Fornecedor A' }).locator('button[aria-label="Editar"]').click()
  await dlg.locator('input:visible').first().fill('Fornecedor B')
  await confirmDialog('Salvar')
  await page.waitForSelector('text=Fornecedor B >> visible=true')
  expect(await page.locator('text=R$ 1.500,00').count(), 'valor monetário não exibido')
})

await check('6 + 14. Expert vê a alteração e não acessa dados de outro expert', async () => {
  const camilaProject = await page.evaluate(() => JSON.parse(localStorage.getItem('launchos:db:v1')).projects.find((p) => p.name.startsWith('Imersão')).id)
  await login('rafael@launchos.demo', 'expert123')
  await page.waitForSelector('text=Progresso da jornada >> visible=true')
  expect((await progressText()).includes('37,5%'), 'expert não vê 37,5%')
  expect(!(await page.locator('text=Camila Duarte').count()), 'expert vê outro expert')
  await page.goto(BASE + '/projetos/' + camilaProject)
  await page.waitForSelector('text=Projeto não encontrado >> visible=true')
  await page.goto(BASE + '/configuracoes')
  await page.waitForSelector('text=Acesso não autorizado >> visible=true')
  await page.goto(jantarUrl + '?aba=fases')
  await page.locator('svg [aria-label^="V4"]').click()
  expect(!(await page.locator('button:has-text("Marcar como concluída")').count()), 'expert pode concluir fase')
  await page.keyboard.press('Escape')
})

await check('6b. Tempo real: alteração em uma aba aparece na outra sem recarregar', async () => {
  await login('admin@launchos.demo', 'admin123')
  const other = await ctx.newPage()
  await other.goto(jantarUrl + '?aba=fases')
  await other.waitForSelector('text=Progresso da jornada >> visible=true')
  await page.goto(jantarUrl + '?aba=fases')
  await page.waitForSelector('text=Progresso da jornada >> visible=true')
  await page.locator('svg [aria-label^="V4"]').click()
  await page.click('button:has-text("Marcar como concluída")')
  await confirmDialog('Marcar como concluída')
  await page.keyboard.press('Escape')
  await other.waitForTimeout(1200)
  const txt = await other.locator('text=Progresso da jornada').locator('..').locator('..').innerText()
  await other.close()
  expect(txt.includes('50%'), 'outra aba não atualizou: ' + txt.split('\n').join(' '))
})

await check('17. Responsivo: celular e tablet sem rolagem horizontal', async () => {
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(BASE + '/')
    await page.waitForSelector('text=Progresso da jornada >> visible=true')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow <= 1, `overflow horizontal de ${overflow}px em ${w}px`)
    await page.screenshot({ path: `${OUT}/mobile-${w}.png`, fullPage: false })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
})

await check('18. Dados demonstrativos identificados; restaurar não afeta registros reais', async () => {
  await login('admin@launchos.demo', 'admin123')
  await page.goto(BASE + '/trafego')
  await page.waitForSelector('text=Dados demonstrativos — conecte sua conta de anúncios >> visible=true')
  await page.goto(BASE + '/configuracoes?aba=demo')
  await page.click('button:has-text("Restaurar dados iniciais")')
  await confirmDialog('Restaurar')
  await page.waitForTimeout(800)
  await page.goto(jantarUrl + '?aba=fases')
  await page.waitForSelector('text=Progresso da jornada >> visible=true')
  expect((await progressText()).includes('25%'), 'demo não voltou a 25%')
  await page.goto(BASE + '/secoes/fornecedores_e2e')
  await page.waitForSelector('text=Fornecedor B >> visible=true')
})

await check('19. Meta: sem backend, conexão fica pendente (não simulada)', async () => {
  await page.goto(BASE + '/configuracoes?aba=integracoes')
  await page.waitForSelector('text=Conexão pendente — o que falta configurar >> visible=true')
  expect(await page.locator('button:has-text("Conectar conta Meta")').isDisabled(), 'botão deveria estar desabilitado sem backend')
})

console.log(results.map((r) => r.join(' ')).join('\n'))
console.log(errors.length ? `\nErros de console/página:\n${[...new Set(errors)].join('\n')}` : '\nSem erros de console.')
await browser.close()
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
