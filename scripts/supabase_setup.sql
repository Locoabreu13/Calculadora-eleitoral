-- ══════════════════════════════════════════════════════════════════
-- Supabase schema — RetotalizaJE · Vereador 2024
-- Execute no SQL Editor do Supabase (dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════════════

-- 1. Índice de municípios (para busca por nome)
CREATE TABLE IF NOT EXISTS municipios_2024 (
    cd_municipio  TEXT        NOT NULL,
    uf            TEXT        NOT NULL,
    nm_municipio  TEXT        NOT NULL,
    vagas         INTEGER,
    PRIMARY KEY (cd_municipio)
);

-- 2. Votos por partido/bloco por município
CREATE TABLE IF NOT EXISTS partidos_2024 (
    cd_municipio  TEXT        NOT NULL,
    sigla         TEXT        NOT NULL,
    nome          TEXT        NOT NULL,
    votos_nominais INTEGER    NOT NULL DEFAULT 0,
    votos_legenda  INTEGER    NOT NULL DEFAULT 0,
    partidos_fed  TEXT[],               -- membros da federação, se houver
    PRIMARY KEY (cd_municipio, sigla),
    FOREIGN KEY (cd_municipio) REFERENCES municipios_2024(cd_municipio)
);

-- 3. Candidatos por partido/bloco por município
CREATE TABLE IF NOT EXISTS candidatos_2024 (
    id            BIGSERIAL   PRIMARY KEY,
    cd_municipio  TEXT        NOT NULL,
    bloco         TEXT        NOT NULL,  -- sigla do partido/federação
    nome          TEXT        NOT NULL,
    votos         INTEGER     NOT NULL DEFAULT 0,
    partido       TEXT        NOT NULL,  -- partido real do candidato
    FOREIGN KEY (cd_municipio) REFERENCES municipios_2024(cd_municipio)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_municipios_nm   ON municipios_2024 (nm_municipio);
CREATE INDEX IF NOT EXISTS idx_municipios_uf   ON municipios_2024 (uf);
CREATE INDEX IF NOT EXISTS idx_partidos_mun    ON partidos_2024   (cd_municipio);
CREATE INDEX IF NOT EXISTS idx_candidatos_mun  ON candidatos_2024 (cd_municipio);
CREATE INDEX IF NOT EXISTS idx_candidatos_bloco ON candidatos_2024 (cd_municipio, bloco);

-- Índice para busca ILIKE por nome (suficiente para 5545 municípios)
CREATE INDEX IF NOT EXISTS idx_municipios_nm_lower ON municipios_2024 (lower(nm_municipio));

-- ── Row Level Security (leitura pública, escrita bloqueada) ────────
ALTER TABLE municipios_2024  ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos_2024    ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos_2024  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica municipios"  ON municipios_2024  FOR SELECT USING (true);
CREATE POLICY "leitura publica partidos"    ON partidos_2024    FOR SELECT USING (true);
CREATE POLICY "leitura publica candidatos"  ON candidatos_2024  FOR SELECT USING (true);
