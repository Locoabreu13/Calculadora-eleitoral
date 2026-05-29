#!/usr/bin/env python3
"""
Carrega dados de Vereador 2024 no Supabase via REST API.
Não requer nenhuma biblioteca externa além das built-in do Python.

Uso:
  python3 scripts/carregar_supabase.py
  python3 scripts/carregar_supabase.py CE        # só um estado
  python3 scripts/carregar_supabase.py CE SP MG  # vários estados
"""
import zipfile, csv, json, sys, time, urllib.request, urllib.error
from io import StringIO
from pathlib import Path
from collections import defaultdict

# ── Configuração ──────────────────────────────────────────────────────────────
try:
    from supabase_config import SUPABASE_URL, SUPABASE_KEY
except ImportError:
    import os
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('❌ Crie scripts/supabase_config.py com SUPABASE_URL e SUPABASE_KEY')
        import sys; sys.exit(1)

CACHE_DIR = Path(__file__).parent.parent / 'cache'
ZIP_PART  = CACHE_DIR / 'votacao_partido_munzona_2024.zip'
ZIP_CAND  = CACHE_DIR / 'votacao_candidato_munzona_2024.zip'

UFS_VALIDAS = [
    'AC','AL','AM','AP','BA','CE','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

BATCH_SIZE = 500   # linhas por requisição POST ao Supabase

# ── HTTP helper ───────────────────────────────────────────────────────────────
def _req(method, tabela, payload=None, params=''):
    url = f'{SUPABASE_URL}/rest/v1/{tabela}{params}'
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            'apikey':        SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type':  'application/json',
            'Prefer':        'resolution=merge-duplicates',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            return json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        raise RuntimeError(f'HTTP {e.code} em {tabela}: {msg}')

def upsert(tabela, rows):
    for i in range(0, len(rows), BATCH_SIZE):
        lote = rows[i:i+BATCH_SIZE]
        _req('POST', tabela, lote)
        print(f'    → {tabela}: {min(i+BATCH_SIZE, len(rows))}/{len(rows)} linhas', end='\r')
    print()

def deletar_municipio(cd):
    # Remove dados existentes para re-carga limpa
    _req('DELETE', 'candidatos_2024', params=f'?cd_municipio=eq.{cd}')
    _req('DELETE', 'partidos_2024',   params=f'?cd_municipio=eq.{cd}')
    _req('DELETE', 'municipios_2024', params=f'?cd_municipio=eq.{cd}')

# ── Processamento ─────────────────────────────────────────────────────────────
def processar_uf(uf, zf_part, zf_cand):
    print(f'\n  ▶ {uf}')

    # CSV de partidos
    nome_p = next((n for n in zf_part.namelist() if n.lower().endswith(f'_{uf.lower()}.csv')), None)
    if not nome_p:
        print(f'    ⚠  CSV de partidos não encontrado para {uf}')
        return
    raw_p = zf_part.read(nome_p).decode('latin-1')

    # Agrupa partidos por município
    muns = {}      # cd -> {nm, uf, partidos: {sigla -> dados}}
    for row in csv.DictReader(StringIO(raw_p), delimiter=';'):
        def v(k): return row.get(k,'').strip().strip('"')
        if v('DS_CARGO').upper() != 'VEREADOR': continue
        cd   = v('CD_MUNICIPIO')
        nm   = v('NM_MUNICIPIO')
        sigla = v('SG_PARTIDO')
        nome  = v('NM_PARTIDO')
        sg_fed = v('SG_FEDERACAO')
        nm_fed = v('NM_FEDERACAO')
        em_fed = sg_fed and sg_fed not in ('#NULO#','-1','')
        chave  = sg_fed if em_fed else sigla
        nome_ent = nm_fed if em_fed else nome
        nom_s = v('QT_VOTOS_NOMINAIS_VALIDOS') or v('QT_VOTOS_NOMINAIS') or '0'
        leg_s = v('QT_TOTAL_VOTOS_LEG_VALIDOS') or v('QT_VOTOS_LEGENDA_VALIDOS') or v('QT_VOTOS_LEGENDA') or '0'
        nom = max(0, int(nom_s) if nom_s.lstrip('-').isdigit() else 0)
        leg = max(0, int(leg_s) if leg_s.lstrip('-').isdigit() else 0)
        if not cd or not chave: continue
        if cd not in muns:
            muns[cd] = {'cd': cd, 'nm': nm, 'uf': uf, 'partidos': {}}
        p = muns[cd]['partidos']
        if chave not in p:
            p[chave] = {'sigla': chave, 'nome': nome_ent, 'nom': 0, 'leg': 0, 'fed': [] if em_fed else None}
        p[chave]['nom'] += nom
        p[chave]['leg'] += leg
        if em_fed and sigla not in p[chave]['fed']:
            p[chave]['fed'].append(sigla)

    print(f'    partidos: {len(muns)} municípios')

    # CSV de candidatos
    nome_c = next((n for n in zf_cand.namelist() if n.lower().endswith(f'_{uf.lower()}.csv')), None)
    if not nome_c:
        print(f'    ⚠  CSV de candidatos não encontrado para {uf}')
        return

    # Mapas de federação por município
    mapa_fed = {}  # cd -> {sigla_partido -> chave_bloco}
    for cd, dados in muns.items():
        mapa_fed[cd] = {}
        for chave, p in dados['partidos'].items():
            if p['fed']:
                for m in p['fed']: mapa_fed[cd][m] = chave
            else:
                mapa_fed[cd][chave] = chave

    raw_c = zf_cand.read(nome_c).decode('latin-1')
    cands = defaultdict(lambda: defaultdict(dict))  # cd -> bloco -> chave_cand -> dados
    for row in csv.DictReader(StringIO(raw_c), delimiter=';'):
        def v(k): return row.get(k,'').strip().strip('"')
        if v('DS_CARGO').upper() != 'VEREADOR': continue
        cd = v('CD_MUNICIPIO')
        if cd not in muns: continue
        sigla_p = v('SG_PARTIDO')
        nome_c2 = v('NM_CANDIDATO')
        num_c   = v('NR_CANDIDATO')
        vs = v('QT_VOTOS_NOMINAIS_VALIDOS') or v('QT_VOTOS_NOMINAIS') or '0'
        votos = max(0, int(vs) if vs.lstrip('-').isdigit() else 0)
        if not nome_c2: continue
        bloco = mapa_fed.get(cd, {}).get(sigla_p, sigla_p)
        chave = f'{num_c}_{nome_c2}'
        if chave not in cands[cd][bloco]:
            cands[cd][bloco][chave] = {'nome': nome_c2, 'votos': 0, 'partido': sigla_p}
        cands[cd][bloco][chave]['votos'] += votos

    # Validação e carga no Supabase
    n_ok = n_div = 0
    for cd, dados in sorted(muns.items()):
        partidos = dados['partidos']
        # Valida somas
        ok = True
        for chave, p in partidos.items():
            if p['nom'] == 0: continue
            soma = sum(c['votos'] for c in cands[cd][chave].values())
            if soma != p['nom']:
                n_div += 1
                ok = False
        if not ok:
            continue

        # Monta rows
        row_mun = {'cd_municipio': cd, 'uf': uf, 'nm_municipio': dados['nm'], 'vagas': None}
        rows_part = [
            {
                'cd_municipio': cd,
                'sigla': chave,
                'nome': p['nome'],
                'votos_nominais': p['nom'],
                'votos_legenda': p['leg'],
                'partidos_fed': p['fed'] if p['fed'] else None,
            }
            for chave, p in partidos.items()
        ]
        rows_cand = [
            {
                'cd_municipio': cd,
                'bloco': bloco,
                'nome': c['nome'],
                'votos': c['votos'],
                'partido': c['partido'],
            }
            for bloco, cs in cands[cd].items()
            for c in cs.values()
        ]

        # Envia ao Supabase
        upsert('municipios_2024', [row_mun])
        upsert('partidos_2024',   rows_part)
        upsert('candidatos_2024', rows_cand)
        n_ok += 1

    print(f'    ✓  {n_ok} municípios carregados, {n_div} com divergência ignorados')

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ufs = [a.upper() for a in sys.argv[1:]] if len(sys.argv) > 1 else list(UFS_VALIDAS)
    for uf in ufs:
        if uf not in UFS_VALIDAS:
            print(f'UF inválida: {uf}'); sys.exit(1)

    print('\n══ Carga Supabase — Vereador 2024 ════════════════════════════')
    print(f'  URL: {SUPABASE_URL}')
    print(f'  UFs: {", ".join(ufs)}')
    print('═══════════════════════════════════════════════════════════════\n')

    with zipfile.ZipFile(ZIP_PART) as zf_part, zipfile.ZipFile(ZIP_CAND) as zf_cand:
        for uf in ufs:
            processar_uf(uf, zf_part, zf_cand)

    print('\n✅ Carga concluída.\n')

if __name__ == '__main__':
    main()
