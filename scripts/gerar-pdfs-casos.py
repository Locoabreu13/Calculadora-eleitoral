"""
Gera os PDFs dos 3 casos validados usando o app.html via Playwright.
Salva em: pdfs/caso_ce.pdf, pdfs/caso_ap.pdf, pdfs/caso_df.pdf

Uso: python3 scripts/gerar-pdfs-casos.py
Requer servidor rodando em http://localhost:5500
"""

import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5500"
OUT_DIR  = Path(__file__).parent.parent / "pdfs"
OUT_DIR.mkdir(exist_ok=True)

CASOS = [
    {
        "id":     "ce2022_cassacao_tse_real",
        "saida":  "caso_ce.pdf",
        "rotulo": "CE 2022 — Cassação Heitor Freire",
    },
    {
        "id":     "ap2022_retotalizacao_tse_real",
        "saida":  "caso_ap.pdf",
        "rotulo": "AP 2022 — Resolução TRE-AP 620/2025",
    },
    {
        "id":     "df2022_retotalizado",
        "saida":  "caso_df.pdf",
        "rotulo": "DF 2022 — Pós-ADIs (Fase 3 → PSB)",
    },
]

def gerar(page, caso):
    print(f"\n→ Gerando: {caso['rotulo']}")

    # Carrega o app
    page.goto(f"{BASE_URL}/app.html", wait_until="networkidle")

    # Bypass auth
    page.evaluate("""() => {
        const auth = document.getElementById('tela-auth');
        const dash = document.getElementById('tela-dashboard');
        if (auth) auth.style.display = 'none';
        if (dash) dash.style.display = 'none';
    }""")
    page.wait_for_timeout(600)

    # Carrega preset
    print(f"  → Carregando preset '{caso['id']}'...")
    page.evaluate(f"carregarPresetRapido('{caso['id']}')")
    page.wait_for_timeout(1000)

    # Clica em Calcular
    print("  → Calculando...")
    btn = page.locator("#btn-calcular")
    btn.wait_for(state="visible", timeout=8000)
    page.wait_for_function(
        "() => !document.getElementById('btn-calcular').disabled",
        timeout=8000
    )
    btn.click()

    # Aguarda resultado
    page.wait_for_selector("#section-resultado tbody tr", timeout=20000)
    page.wait_for_timeout(800)

    # Intercepta o download do PDF
    print("  → Exportando PDF...")
    output_path = OUT_DIR / caso["saida"]
    with page.expect_download(timeout=30000) as dl_info:
        page.locator("#btn-exportar-pdf").click()
    dl = dl_info.value
    dl.save_as(str(output_path))

    size_kb = output_path.stat().st_size // 1024
    print(f"  ✓ Salvo em: {output_path} ({size_kb} KB)")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        for caso in CASOS:
            gerar(page, caso)

        browser.close()

    print("\n✓ Todos os PDFs gerados em pdfs/")

if __name__ == "__main__":
    main()
