"""
Captura screenshot do painel de resultados do RetotalizaJE.
Caso: CE 2022 — Cassação Heitor Freire (UNIÃO, 48888 votos, modalidade Total)
Salva em: css/hero-screenshot.png

Uso: python3 scripts/capturar-screenshot.py
Requer servidor rodando em http://localhost:5500
"""

import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "http://localhost:5500"
OUTPUT   = Path(__file__).parent.parent / "css" / "hero-screenshot.png"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        print("→ Abrindo app.html...")
        page.goto(f"{BASE_URL}/app.html", wait_until="networkidle")

        # Bypass auth: esconde tela-auth e tela-dashboard para mostrar a calculadora
        print("→ Ignorando tela de autenticação...")
        page.evaluate("""() => {
            const auth = document.getElementById('tela-auth');
            const dash = document.getElementById('tela-dashboard');
            if (auth) auth.style.display = 'none';
            if (dash) dash.style.display = 'none';
        }""")

        # Abre o painel de importação TSE
        print("→ Abrindo painel de importação TSE...")
        toggle = page.locator("#btn-toggle-import")
        toggle.wait_for(state="visible", timeout=10000)
        toggle.click()

        page.locator("#import-body").wait_for(state="visible", timeout=5000)

        # Seleciona Ano 2022
        print("→ Selecionando 2022...")
        page.select_option("#tse-ano", "2022")
        page.wait_for_timeout(800)

        # Aguarda UF ser habilitado e seleciona CE
        print("→ Selecionando CE...")
        page.wait_for_selector("#tse-uf:not([disabled])", timeout=8000)
        page.select_option("#tse-uf", "CE")
        page.wait_for_timeout(800)

        # Aguarda Cargo ser habilitado e seleciona federal
        print("→ Selecionando Deputado Federal...")
        page.wait_for_selector("#tse-cargo:not([disabled])", timeout=8000)
        # Seleciona a opção que contém "federal"
        cargo_options = page.eval_on_selector_all(
            "#tse-cargo option",
            "opts => opts.map(o => ({ value: o.value, text: o.textContent }))"
        )
        federal_value = next(
            (o["value"] for o in cargo_options if "federal" in o["text"].lower()),
            None
        )
        if not federal_value:
            raise RuntimeError(f"Opção 'federal' não encontrada. Opções: {cargo_options}")
        page.select_option("#tse-cargo", federal_value)
        page.wait_for_timeout(500)

        # Clica em Carregar
        print("→ Clicando em Carregar do TSE...")
        btn_carregar = page.locator("#btn-tse-carregar")
        btn_carregar.wait_for(state="visible", timeout=8000)
        # Aguarda o botão ficar habilitado (JS remove o atributo disabled após selects preenchidos)
        page.wait_for_function(
            "() => !document.getElementById('btn-tse-carregar').disabled",
            timeout=8000
        )
        btn_carregar.click()

        # Aguarda os dados carregarem (status muda ou partidos aparecem)
        print("→ Aguardando dados do TSE...")
        page.wait_for_function(
            """() => {
                const status = document.getElementById('tse-direto-status');
                return status && (
                    status.textContent.includes('carregad') ||
                    status.textContent.includes('partido') ||
                    status.textContent.includes('OK') ||
                    status.textContent.includes('✓')
                );
            }""",
            timeout=30000
        )
        page.wait_for_timeout(1000)

        # Adiciona cassação
        print("→ Adicionando cassação...")
        btn_add_cass = page.locator("#btn-adicionar-cassacao")
        btn_add_cass.wait_for(state="visible", timeout=8000)
        btn_add_cass.click()
        page.wait_for_timeout(600)

        # Preenche partido (UNIÃO)
        print("→ Preenchendo partido UNIÃO...")
        # Usa evaluate para inspecionar e preencher a última cassação-row
        partido_info = page.evaluate("""() => {
            const row = document.querySelectorAll('.cassacao-row');
            const el = row[row.length - 1].querySelector('.cass-partido');
            return { tag: el.tagName.toLowerCase(), options: el.tagName === 'SELECT'
                ? Array.from(el.options).map(o => ({ v: o.value, t: o.text }))
                : [] };
        }""")
        if partido_info["tag"] == "select":
            uniao_val = next(
                (o["v"] for o in partido_info["options"]
                 if "uni" in o["t"].lower() or "uni" in o["v"].lower()), None)
            if uniao_val:
                page.evaluate(f"""() => {{
                    const rows = document.querySelectorAll('.cassacao-row');
                    const el = rows[rows.length-1].querySelector('.cass-partido');
                    el.value = '{uniao_val}';
                    el.dispatchEvent(new Event('change', {{bubbles:true}}));
                }}""")
        else:
            page.evaluate("""() => {
                const rows = document.querySelectorAll('.cassacao-row');
                const el = rows[rows.length-1].querySelector('.cass-partido');
                el.value = 'UNIÃO';
                el.dispatchEvent(new Event('input', {bubbles:true}));
            }""")
        page.wait_for_timeout(500)

        # Preenche candidato (Heitor Freire)
        print("→ Preenchendo candidato Heitor Freire...")
        cand_info = page.evaluate("""() => {
            const row = document.querySelectorAll('.cassacao-row');
            const el = row[row.length - 1].querySelector('.cass-candidato');
            return { tag: el.tagName.toLowerCase(), options: el.tagName === 'SELECT'
                ? Array.from(el.options).map(o => ({ v: o.value, t: o.text }))
                : [] };
        }""")
        if cand_info["tag"] == "select":
            heitor_val = next(
                (o["v"] for o in cand_info["options"]
                 if "heitor" in o["t"].lower()), None)
            if heitor_val:
                page.evaluate(f"""() => {{
                    const rows = document.querySelectorAll('.cassacao-row');
                    const el = rows[rows.length-1].querySelector('.cass-candidato');
                    el.value = '{heitor_val}';
                    el.dispatchEvent(new Event('change', {{bubbles:true}}));
                }}""")
        else:
            page.evaluate("""() => {
                const rows = document.querySelectorAll('.cassacao-row');
                const el = rows[rows.length-1].querySelector('.cass-candidato');
                el.value = 'Heitor Freire';
                el.dispatchEvent(new Event('input', {bubbles:true}));
            }""")
        page.wait_for_timeout(300)

        # Preenche votos
        print("→ Preenchendo 48888 votos...")
        page.evaluate("""() => {
            const rows = document.querySelectorAll('.cassacao-row');
            const el = rows[rows.length-1].querySelector('.cass-votos');
            el.value = '48888';
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
        }""")
        page.wait_for_timeout(200)

        # Seleciona modalidade Total
        print("→ Selecionando modalidade Total...")
        modal_info = page.evaluate("""() => {
            const row = document.querySelectorAll('.cassacao-row');
            const el = row[row.length - 1].querySelector('.cass-modalidade');
            return { tag: el.tagName.toLowerCase(), options: el.tagName === 'SELECT'
                ? Array.from(el.options).map(o => ({ v: o.value, t: o.text }))
                : [] };
        }""")
        if modal_info["tag"] == "select":
            total_val = next(
                (o["v"] for o in modal_info["options"]
                 if "total" in o["t"].lower() or "total" in o["v"].lower()), None)
            if total_val:
                page.evaluate(f"""() => {{
                    const rows = document.querySelectorAll('.cassacao-row');
                    const el = rows[rows.length-1].querySelector('.cass-modalidade');
                    el.value = '{total_val}';
                    el.dispatchEvent(new Event('change', {{bubbles:true}}));
                }}""")
        else:
            page.evaluate("""() => {
                const rows = document.querySelectorAll('.cassacao-row');
                const el = rows[rows.length-1].querySelector('.cass-modalidade');
                el.value = 'total';
                el.dispatchEvent(new Event('change', {bubbles:true}));
            }""")

        page.wait_for_timeout(300)

        # Clica em Calcular
        print("→ Clicando em Calcular...")
        btn_calc = page.locator("#btn-calcular")
        btn_calc.wait_for(state="visible", timeout=5000)
        btn_calc.click()

        # Aguarda resultado aparecer em #section-resultado
        print("→ Aguardando resultados...")
        page.wait_for_selector(
            "#section-resultado tbody tr",
            timeout=20000
        )
        page.wait_for_timeout(1000)

        # Captura screenshot da área de resultados
        print("→ Capturando screenshot...")
        resultado = page.locator(".result-sections")
        resultado.wait_for(state="visible", timeout=5000)
        resultado.screenshot(path=str(OUTPUT))

        browser.close()

        if OUTPUT.exists():
            size_kb = OUTPUT.stat().st_size // 1024
            print(f"✓ Screenshot salvo em: {OUTPUT}")
            print(f"  Tamanho: {size_kb} KB")
        else:
            print("✗ Arquivo não foi criado.")

if __name__ == "__main__":
    main()
