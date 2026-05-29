#!/usr/bin/env python3
"""
Adiciona candidatos aos JSONs de deputado estadual 2022.
Mesmo comportamento de scripts/adicionar-candidatos.js, para todos os estados.

Uso:
  python3 scripts/adicionar_candidatos_estadual.py        # todos os estados
  python3 scripts/adicionar_candidatos_estadual.py CE     # um estado
"""
import zipfile
import csv
import json
import sys
import os
from io import StringIO
from pathlib import Path
from datetime import datetime, timezone

UFS = [
    'AC','AL','AM','AP','BA','CE','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]  # DF excluído (não tem deputado estadual)

CARGO_ALVO    = 'DEPUTADO ESTADUAL'
CARGO_LEGIVEL = 'Deputado Estadual'
CARGO_SLUG    = 'estadual'

BASE_DIR  = Path(__file__).parent.parent
CACHE_DIR = BASE_DIR / 'cache'
DATA_DIR  = BASE_DIR / 'data' / 'tse'
ZIP_PATH  = CACHE_DIR / 'votacao_candidato_munzona_2022.zip'

def processar_uf(zip_ref, uf):
    json_path = DATA_DIR / f'2022_{uf}_{CARGO_SLUG}.json'
    if not json_path.exists():
        print(f'  ⚠  {uf}: JSON base não encontrado, pulando.')
        return

    existente = json.loads(json_path.read_text(encoding='utf-8'))
    partidos  = existente['partidos']

    if not partidos:
        print(f'  ⚠  {uf}: nenhum partido no JSON (provavelmente DF), pulando.')
        return

    # Monta mapa partido→bloco (para federações)
    mapa_fed = {}
    for p in partidos:
        if p.get('partidos'):
            for membro in p['partidos']:
                mapa_fed[membro] = p['sigla']
        else:
            mapa_fed[p['sigla']] = p['sigla']

    # Localiza o CSV da UF no ZIP
    nome_csv = None
    for name in zip_ref.namelist():
        if name.lower().endswith(f'_{uf.lower()}.csv'):
            nome_csv = name
            break
    if not nome_csv:
        print(f'  ⚠  {uf}: CSV não encontrado no ZIP de candidatos.')
        return

    print(f'  ▶ {uf} — extraindo {os.path.basename(nome_csv)}…')
    raw    = zip_ref.read(nome_csv).decode('latin-1')
    reader = csv.DictReader(StringIO(raw), delimiter=';')

    por_bloco = {}  # bloco_sigla -> { chave_cand -> {nome, votos, partido} }
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

        sigla_partido = row.get('SG_PARTIDO', '').strip().strip('"')
        nome_cand     = row.get('NM_CANDIDATO', '').strip().strip('"')
        num_cand      = row.get('NR_CANDIDATO', '').strip().strip('"')

        votos_str = (row.get('QT_VOTOS_NOMINAIS_VALIDOS') or
                     row.get('QT_VOTOS_NOMINAIS') or '0').strip().strip('"')
        votos = int(votos_str) if votos_str.lstrip('-').isdigit() else 0
        if votos < 0: votos = 0

        if not sigla_partido or not nome_cand:
            n_ign += 1
            continue

        bloco_key = mapa_fed.get(sigla_partido, sigla_partido)
        chave     = f'{num_cand}_{nome_cand}'

        if bloco_key not in por_bloco:
            por_bloco[bloco_key] = {}
        if chave not in por_bloco[bloco_key]:
            por_bloco[bloco_key][chave] = {'nome': nome_cand, 'votos': 0, 'partido': sigla_partido}
        por_bloco[bloco_key][chave]['votos'] += votos
        n_proc += 1

    print(f'    linhas: {n_proc:,} úteis, {n_ign:,} ignoradas'.replace(',', '.'))

    # Converte para listas ordenadas
    candidatos_por_bloco = {
        bloco: sorted(cands.values(), key=lambda c: -c['votos'])
        for bloco, cands in por_bloco.items()
    }

    total_cands = sum(len(v) for v in candidatos_por_bloco.values())
    print(f'    total de candidatos: {total_cands:,}'.replace(',', '.'))

    # Validação: soma dos candidatos deve bater com votosNominais
    divergencias = []
    for p in partidos:
        if p['votosNominais'] == 0:
            continue
        cands = candidatos_por_bloco.get(p['sigla'], [])
        soma  = sum(c['votos'] for c in cands)
        if soma != p['votosNominais']:
            divergencias.append({
                'sigla': p['sigla'],
                'esperado': p['votosNominais'],
                'obtido': soma,
                'diff': soma - p['votosNominais'],
            })

    if divergencias:
        print(f'\n  ❌ {uf}: VALIDAÇÃO FALHOU — JSON não alterado.')
        for d in divergencias:
            sinal = '+' if d['diff'] > 0 else ''
            print(f'     {d["sigla"]:20s} esperado: {d["esperado"]:>10,}  obtido: {d["obtido"]:>10,}  diff: {sinal}{d["diff"]:,}'.replace(',', '.'))
        return

    # Adiciona candidatos ao JSON
    for p in partidos:
        p['candidatos'] = candidatos_por_bloco.get(p['sigla'], [])

    # Atualiza timestamp
    existente['meta']['gerado'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    conteudo = json.dumps(existente, ensure_ascii=False, indent=4)
    json_path.write_text(conteudo, encoding='utf-8')
    kb = len(conteudo.encode('utf-8')) / 1024
    print(f'    ✓  {json_path.name}  ({kb:.1f} KB, {total_cands} candidatos)\n')

def main():
    if not ZIP_PATH.exists():
        print(f'❌ ZIP não encontrado: {ZIP_PATH}')
        sys.exit(1)

    ufs = [sys.argv[1].upper()] if len(sys.argv) > 1 else list(UFS)

    print(f'\n══ Adicionar Candidatos — Deputado Estadual 2022 ══════════════')
    print(f'  ZIP: {ZIP_PATH}')
    print(f'  UFs: {", ".join(ufs)}')
    print('═══════════════════════════════════════════════════════════════\n')

    with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
        csvs = [n for n in zf.namelist() if n.lower().endswith('.csv')]
        print(f'CSVs no ZIP: {len(csvs)} arquivos\n')
        for uf in ufs:
            processar_uf(zf, uf)

    print('\n✅ Concluído.\n')

if __name__ == '__main__':
    main()
