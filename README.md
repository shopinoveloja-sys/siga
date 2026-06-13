# SIGA Mobilidade

Experiencia web responsiva para a plataforma SIGA, reunindo jornadas de passageiro e motorista em um produto unico, pronto para deploy via Docker/Coolify.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy no Coolify

O projeto inclui `Dockerfile`, `nginx.conf` e `coolify.json`. No Coolify, crie uma aplicacao a partir do repositorio GitHub e use o build pack Dockerfile. A aplicacao expoe a porta `80`.
