#!/usr/bin/env python3
"""
Gera 2022_{UF}_estadual.json para todos os estados a partir do ZIP local.
Produz o mesmo formato que scripts/processar-tse.js.

Uso:
  python3 scripts/processar_estadual.py
  python3 scripts/processar_estadual.py CE
"""
import zipfile
import csv
import json
import sys
import os
from io import StringIO
from datetime import datetime, timezone
from pathlib import Path

UFS = [
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

CARGO_ALVO    = 'DEPUTADO ESTADUAL'
CARGO_LEGIVEL = 'Deputado Estadual'
CARGO_SLUG    = 'estadual'

BASE_DIR  = Path(__file__).parent.parent
CACHE_DIR = BASE_DIR / 'cache'
DATA_DIR  = BASE_DIR / 'data' / 'tse'
ZIP_PATH  = CACHE_DIR / 'votacao_partido_munzona_2022.zip'

def processar_uf(zip_ref, uf):
    # Localiza o CSV da UF dentro do ZIP
    nome_csv = None
    for name in zip_ref.namelist():
        if name.upper().endswith(f'_{uf}.CSV') and name.endswith('.csv'):
            nome_csv = name
            break
    if not nome_csv:
        # tenta case insensitive
        for name in zip_ref.namelist():
            if name.lower().endswith(f'_{uf.lower()}.csv'):
                nome_csv = name
                break
    if not nome_csv:
        print(f'  ⚠  CSV para {uf} não encontrado no ZIP')
        return

    print(f'  ▶ {uf} — extraindo {os.path.basename(nome_csv)}…')
    raw = zip_ref.read(nome_csv).decode('latin-1')
    reader = csv.DictReader(StringIO(raw), delimiter=';')

    # Mapeia nomes de colunas (TSE usa variações)
    def col(row, *nomes):
        for n in nomes:
            if n in row:
                return row[n].strip().strip('"')
        return ''

    estado = {}  # sigla_bloco -> dados
    n_proc = 0
    n_ign  = 0

    for row in reader:
        cargo_raw = row.get('DS_CARGO', '').strip().strip('"').upper()
        if cargo_raw != CARGO_ALVO:
            n_ign += 1
            continue

        uf_csv = row.get('SG_UF', '').strip().strip('"').upper()
        if uf_csv and uf_csv != uf:
            n_ign += 1
            continue

        sigla = col(row, 'SG_PARTIDO').strip()
        nome  = col(row, 'NM_PARTIDO').strip()
        if not sigla:
            n_ign += 1
            continue

        nom_str = col(row, 'QT_VOTOS_NOMINAIS_VALIDOS', 'QT_VOTOS_NOMINAIS')
        leg_str = col(row, 'QT_TOTAL_VOTOS_LEG_VALIDOS', 'QT_VOTOS_LEGENDA_VALIDOS', 'QT_VOTOS_LEGENDA')
        nom = int(nom_str) if nom_str.lstrip('-').isdigit() else 0
        leg = int(leg_str) if leg_str.lstrip('-').isdigit() else 0
        if nom < 0: nom = 0
        if leg < 0: leg = 0

        # Federações
        sg_fed = col(row, 'SG_FEDERACAO').strip()
        nm_fed = col(row, 'NM_FEDERACAO').strip()
        em_fed = sg_fed and sg_fed not in ('#NULO#', '-1', '')
        chave  = sg_fed if em_fed else sigla
        nome_ent = nm_fed if em_fed else nome

        if chave not in estado:
            estado[chave] = {
                'sigla': chave,
                'nome': nome_ent,
                'votosNominais': 0,
                'votosLegenda': 0,
            }
            if em_fed:
                estado[chave]['partidos'] = []

        estado[chave]['votosNominais'] += nom
        estado[chave]['votosLegenda']  += leg

        if em_fed:
            if sigla not in estado[chave].get('partidos', []):
                estado[chave].setdefault('partidos', []).append(sigla)

        n_proc += 1

    print(f'    linhas: {n_proc:,} úteis, {n_ign:,} ignoradas'.replace(',', '.'))

    partidos = sorted(
        estado.values(),
        key=lambda p: -(p['votosNominais'] + p['votosLegenda'])
    )

    saida = {
        'meta': {
            'ano': '2022',
            'uf': uf,
            'cargo': CARGO_LEGIVEL,
            'gerado': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        },
        'partidos': partidos,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fname  = f'2022_{uf}_{CARGO_SLUG}.json'
    fpath  = DATA_DIR / fname
    conteudo = json.dumps(saida, ensure_ascii=False, indent=4)
    fpath.write_text(conteudo, encoding='utf-8')

    kb = len(conteudo.encode('utf-8')) / 1024
    print(f'    ✓  {fname}  ({kb:.1f} KB, {len(partidos)} partidos)')

def main():
    if not ZIP_PATH.exists():
        print(f'❌ ZIP não encontrado: {ZIP_PATH}')
        sys.exit(1)

    ufs = [sys.argv[1].upper()] if len(sys.argv) > 1 else list(UFS)
    print(f'\n══ Processar TSE — Deputado Estadual 2022 ═════════════════════')
    print(f'  ZIP: {ZIP_PATH}')
    print(f'  UFs: {", ".join(ufs)}')
    print('═══════════════════════════════════════════════════════════════\n')

    with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
        csvs = [n for n in zf.namelist() if n.lower().endswith('.csv')]
        print(f'CSVs no ZIP: {", ".join(os.path.basename(c) for c in csvs)}\n')
        for uf in ufs:
            processar_uf(zf, uf)

    print('\n✅ Concluído.\n')

if __name__ == '__main__':
    main()
