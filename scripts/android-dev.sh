#!/usr/bin/env bash
set -euo pipefail

# Garante que trace nunca esteja ativo ao carregar variáveis sensíveis
set +x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APK_REL_PATH="build/avisai-dev-debug.apk"
APK_HOST_PATH="${ROOT_DIR}/${APK_REL_PATH}"

load_env() {
  local env_file="${ROOT_DIR}/.env"
  if [[ -f "${env_file}" ]]; then
    set +x
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
}

print_help() {
  cat <<'EOF'
AvisAI Mobile — Docker & USB Android Dev CLI (Node 20 + JDK 17 + Android SDK 35 + NDK 26)

Uso:
  ./scripts/android-dev.sh <subcomando>

Subcomandos:
  install      Executa `npm install` dentro do container Node 20 (Dockerfile.dev)
  typecheck    Executa `npm run typecheck` dentro do container Node 20
  test         Executa `npm test` dentro do container Node 20
  build-apk    Gera o Android Dev Build APK em `build/avisai-dev-debug.apk` via Docker
  devices      Lista dispositivos Android conectados via USB (`adb devices`)
  install-apk  Instala `build/avisai-dev-debug.apk` via USB (`adb install -r`) e aplica `adb reverse tcp:8081 tcp:8081`
  metro        Sobe o servidor Metro Dev Client na porta 8081
  help         Exibe estas instruções rápidas

Variáveis de ambiente opcionais (via .env ou shell):
  GOOGLE_MAPS_API_KEY_ANDROID   Chave do Google Maps SDK para Android
  EXPO_PUBLIC_API_MODE          Modo da API (mock | live)
  EXPO_PUBLIC_API_BASE_URL      URL base do backend (ex.: http://localhost:8787)
  EXPO_PUBLIC_VOICE_MODE        Modo de voz (mock | live)
  EXPO_PREBUILD_CLEAN           Se definido como 1, força `--clean` no `expo prebuild`
EOF
}

run_compose() {
  docker compose -f "${ROOT_DIR}/docker-compose.yml" "$@"
}

cmd_install() {
  echo "[avisai-mobile] Executando npm install no container Node 20..."
  run_compose run --rm metro npm install
}

cmd_typecheck() {
  echo "[avisai-mobile] Executando npm run typecheck no container Node 20..."
  run_compose run --rm metro npm run typecheck
}

cmd_test() {
  echo "[avisai-mobile] Executando npm test no container Node 20..."
  run_compose run --rm metro npm test
}

cmd_build_apk() {
  echo "[avisai-mobile] Iniciando build do Android Dev Client APK via Docker..."
  run_compose run --rm android-build
  if [[ -f "${APK_HOST_PATH}" ]]; then
    echo "[avisai-mobile] APK pronto em: ${APK_REL_PATH}"
  else
    echo "[avisai-mobile] ERRO: APK não encontrado em ${APK_REL_PATH} após o build." >&2
    exit 1
  fi
}

cmd_devices() {
  echo "[avisai-mobile] Listando dispositivos Android USB conectados..."
  run_compose run --rm adb devices -l
}

cmd_install_apk() {
  if [[ ! -f "${APK_HOST_PATH}" ]]; then
    echo "[avisai-mobile] ERRO: ${APK_REL_PATH} não encontrado. Rode './scripts/android-dev.sh build-apk' primeiro." >&2
    exit 1
  fi
  echo "[avisai-mobile] Instalando ${APK_REL_PATH} no dispositivo USB..."
  run_compose run --rm adb install -r "/app/${APK_REL_PATH}"
  echo "[avisai-mobile] Configurando adb reverse tcp:8081 tcp:8081..."
  run_compose run --rm adb reverse tcp:8081 tcp:8081
  echo "[avisai-mobile] APK instalado e túnel tcp:8081 configurado com sucesso."
}

cmd_metro() {
  echo "[avisai-mobile] Iniciando Metro Dev Client na porta 8081..."
  run_compose run --rm --service-ports metro
}

main() {
  load_env

  local subcommand="${1:-help}"
  case "${subcommand}" in
    install)
      cmd_install
      ;;
    typecheck)
      cmd_typecheck
      ;;
    test)
      cmd_test
      ;;
    build-apk)
      cmd_build_apk
      ;;
    devices)
      cmd_devices
      ;;
    install-apk)
      cmd_install_apk
      ;;
    metro)
      cmd_metro
      ;;
    help|-h|--help)
      print_help
      ;;
    *)
      echo "[avisai-mobile] Subcomando desconhecido: '${subcommand}'" >&2
      echo "" >&2
      print_help >&2
      exit 1
      ;;
  esac
}

main "$@"
