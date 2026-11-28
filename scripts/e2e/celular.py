#!/usr/bin/env python3
"""E2E no celular: app real (Dev Build) + voz LiveKit real + backend local + ação do CCO.

Dirige o Android por adb, fala com o AvisAI pelo alto-falante do computador (o microfone do
celular capta), move o caminhão com o GPS simulado do backend e confere cada etapa na API.
Relatório e capturas de tela em e2e-resultados/<data-hora>/ (pasta ignorada pelo git).

Pré-requisitos (ver README, seção "Teste ponta a ponta no celular"):
  - backend local no ar (`docker compose up` no rodar-backend), com LiveKit e LLM configurados;
  - Dev Build instalado no celular, USB com depuração e o Metro rodando (`npm start`);
  - .env do app com EXPO_PUBLIC_API_MODE=http e EXPO_PUBLIC_VOICE_MODE=livekit;
  - celular perto do alto-falante do computador (pw-play, PipeWire).

Uso: python3 scripts/e2e/celular.py [--rota 2] [--email marina@rotasul.test] [--sink 40]
Só usa a biblioteca padrão.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PACOTE = "com.chapahalls.avisai"
CCO_EMAIL = "cco@avisai.test"


class Falhou(RuntimeError):
    pass


class E2E:
    def __init__(self, a: argparse.Namespace):
        self.a = a
        self.saida = RAIZ / "e2e-resultados" / datetime.now().strftime("%Y%m%d-%H%M%S")
        self.saida.mkdir(parents=True, exist_ok=True)
        self.etapas: list[tuple[str, bool, str]] = []
        self.inicio = time.time()
        self.quedas_esperadas = 0

    # ---------- infraestrutura ----------
    def sh(self, *cmd: str, check: bool = True, **kw) -> str:
        r = subprocess.run(cmd, capture_output=True, text=True, **kw)
        if check and r.returncode != 0:
            raise Falhou(f"{' '.join(cmd[:3])}…: {r.stderr.strip()[:300]}")
        return r.stdout

    def adb(self, *args: str, check: bool = True) -> str:
        return self.sh("adb", *(["-s", self.a.serial] if self.a.serial else []), *args, check=check)

    def http(self, metodo: str, caminho: str, corpo: dict | None = None, token: str = ""):
        h = {"Content-Type": "application/json"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(self.a.api + caminho, method=metodo, headers=h,
                                     data=json.dumps(corpo).encode() if corpo is not None else None)
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}")

    def token(self, email: str) -> str:
        return self.http("POST", "/auth/sso", {"email": email})["token"]

    def eventos(self) -> list[dict]:
        return list(reversed(self.http("GET", f"/eventos?rota_id={self.a.rota}&limite=200")))

    def status_rota(self) -> str:
        return self.http("GET", f"/rotas/{self.a.rota}")["status"]

    def esperar(self, descricao: str, cond, timeout: float = 45, passo: float = 1.5):
        fim = time.time() + timeout
        while time.time() < fim:
            v = cond()
            if v:
                return v
            time.sleep(passo)
        raise Falhou(f"tempo esgotado esperando: {descricao}")

    def etapa(self, nome: str, ok: bool, detalhe: str = "") -> None:
        self.etapas.append((nome, ok, detalhe))
        print(f"  {'ok ' if ok else 'FALHOU'}  {nome}{' · ' + detalhe if detalhe else ''}", flush=True)
        if not ok:
            raise Falhou(nome)

    def tela(self, nome: str) -> None:
        serial = ["-s", self.a.serial] if self.a.serial else []
        png = subprocess.run(["adb", *serial, "exec-out", "screencap", "-p"], capture_output=True).stdout
        (self.saida / f"{nome}.png").write_bytes(png)

    # ---------- UI (uiautomator) ----------
    def nos(self) -> list[tuple[str, tuple[int, int]]]:
        # Com a esfera animando, o dump falha ("could not get idle state") e deixaria o XML
        # anterior no lugar: apaga antes para nunca ler uma tela velha.
        self.adb("shell", "rm", "-f", "/sdcard/e2e-ui.xml", check=False)
        self.adb("shell", "uiautomator", "dump", "/sdcard/e2e-ui.xml", check=False)
        xml = self.adb("shell", "cat", "/sdcard/e2e-ui.xml", check=False)
        if "<hierarchy" not in xml:
            return []
        try:
            raiz = ET.fromstring(xml[xml.find("<?xml"):] if "<?xml" in xml else xml)
        except ET.ParseError:
            return []
        out = []
        for n in raiz.iter("node"):
            texto = f"{n.get('text') or ''} {n.get('content-desc') or ''}".strip()
            b = list(map(int, re.findall(r"\d+", n.get("bounds") or "")))
            if texto and len(b) == 4:
                out.append((texto, ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)))
        return out

    def tocar(self, trecho: str, timeout: float = 40) -> None:
        def achar():
            for texto, xy in self.nos():
                if trecho.lower() in texto.lower():
                    return xy
            return None
        x, y = self.esperar(f"'{trecho}' na tela", achar, timeout, 2)
        self.adb("shell", "input", "tap", str(x), str(y))

    # ---------- voz ----------
    def falar(self, texto: str) -> None:
        cont = self.a.container_voz
        self.sh("docker", "cp", str(RAIZ / "scripts/e2e/tts.py"), f"{cont}:/tmp/e2e_tts.py")
        self.sh("docker", "exec", cont, "python", "/tmp/e2e_tts.py", texto, "/tmp/e2e_fala.wav")
        wav = self.saida / "fala.wav"
        self.sh("docker", "cp", f"{cont}:/tmp/e2e_fala.wav", str(wav))
        alvo = ["--target", self.a.sink] if self.a.sink else []
        self.sh("pw-play", *alvo, "--volume", "1.0", str(wav))

    def falar_ate(self, descricao: str, frases: list[str], cond, timeout: float = 30) -> None:
        """Fala e espera o efeito no backend; repete com outra frase se o STT não pegou."""
        for frase in frases:
            self.falar(frase)
            try:
                self.esperar(descricao, cond, timeout)
                return
            except Falhou:
                continue
        raise Falhou(f"voz não produziu: {descricao}")

    def tem_evento(self, tipo: str, desde: int = 0):
        return lambda: next((e for e in self.eventos() if e["tipo"] == tipo and e["id"] > desde), None)

    def ultimo_id(self) -> int:
        ev = self.eventos()
        return ev[-1]["id"] if ev else 0

    # ---------- roteiro ----------
    def rodar(self) -> None:
        a = self.a
        print(f"E2E no celular · rota {a.rota} · {a.email} · saída {self.saida.relative_to(RAIZ)}")

        saude = self.http("GET", "/health")
        self.etapa("backend no ar com LiveKit", bool(saude.get("ok") and saude.get("livekit_configurada")),
                   f"banco_ok={saude.get('banco_ok')} llm={saude.get('llm_mode')}")
        dispositivos = self.sh("adb", "devices").split("\n")[1:]
        self.etapa("celular conectado por USB", any("\tdevice" in d for d in dispositivos))
        self.etapa("app instalado", PACOTE in self.adb("shell", "pm", "list", "packages", PACOTE))
        try:
            urllib.request.urlopen(a.metro + "/status", timeout=5)
            metro = True
        except OSError:
            metro = False
        self.etapa("Metro no ar", metro, a.metro)

        motorista = self.token(a.email)
        self.http("POST", f"/rotas/{a.rota}/reset", {}, motorista)
        self.etapa("rota resetada", self.status_rota() == "planejada")

        self.adb("reverse", "tcp:8081", "tcp:8081")
        self.adb("logcat", "-c")
        self.adb("shell", "am", "force-stop", PACOTE)
        self.adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d",
                 "exp+avisai-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081")

        def tela_login():
            textos = " | ".join(t for t, _ in self.nos())
            if "Continue" in textos:  # menu de desenvolvedor do Dev Build na 1ª abertura
                self.tocar("Continue")
                self.adb("shell", "input", "keyevent", "BACK")
                return None
            return "Entrar como" in textos
        self.esperar("tela de login", tela_login, 180, 3)
        self.tocar(a.email)
        self.tocar("Entrar como")
        self.tocar("Iniciar viagem")
        self.esperar("RouteAssigned no backend", lambda: any(
            e["tipo"] == "evento_app" and "RouteAssigned" in e["mensagem"] for e in self.eventos()))
        self.etapa("login e viagem iniciada pelo app", True)
        self.tela("01-viagem-iniciada")

        marco = self.ultimo_id()
        self.tocar("Abrir AvisAI")
        self.esperar("agente LiveKit na sala", self.tem_evento("sessao_iniciada", marco), 40)
        time.sleep(10)  # deixa o agente terminar a saudação
        self.etapa("voz real: agente LiveKit entrou na sala do motorista", True)

        self.falar_ate("retirada confirmada", [
            "Já peguei a carga, pode confirmar a retirada.",
            "Carga retirada. Confirmo a retirada da carga.",
        ], lambda: self.status_rota() == "em_transito")
        self.etapa("retirada por voz → rota em_transito", True)
        time.sleep(3)
        self.tela("02-modo-direcao")

        marco = self.ultimo_id()
        self.falar_ate("relatório inicial", [
            "O caminhão está bom e a carga está bem amarrada, sem avaria.",
            "Tudo certo com o caminhão, carga amarrada e sem nenhum problema.",
        ], self.tem_evento("relatorio", marco), 35)
        self.etapa("relatório inicial por voz", True)

        cco = self.token(CCO_EMAIL)
        sim = subprocess.Popen(
            ["docker", "compose", "exec", "-T", "api", "python", "/scripts/simular_rota.py",
             "--api", "http://localhost:8000", "--rota", str(a.rota), "--passo", "0.7"],
            cwd=a.backend, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.esperar("aproximação (geocerca)", self.tem_evento("aproximacao"), 120)
        self.etapa("GPS: aproximação detectada e falada pelo agente", True)
        self.tela("03-aproximando")
        self.esperar("chegada (geocerca)", lambda: self.status_rota() == "no_destino", 120)
        sim.wait(timeout=60)
        # O CCO assume a Task: testa a ação da central e para o escalonamento (sem ligação real).
        task = self.esperar("Task de chegada", lambda: next(
            (t for t in self.http("GET", "/tasks") if t["rota_id"] == a.rota and t["status"] != "confirmada"), None))
        self.http("POST", f"/tasks/{task['id']}/confirmar", {"confirmado_por": "Ana (CCO) · e2e"}, cco)
        self.etapa("chegada pela geocerca e Task assumida pelo CCO", True, f"task {task['id']}")
        time.sleep(4)
        self.tela("04-chegada")

        marco = self.ultimo_id()
        self.falar_ate("chegada confirmada por voz", [
            "Sim, confirmo a chegada. Estou na portaria do recebedor.",
            "Cheguei, confirmo a chegada no recebedor.",
        ], self.tem_evento("chegada_confirmada_voz", marco))
        self.etapa("chegada confirmada por voz", True)

        marco = self.ultimo_id()
        self.falar_ate("check-in", [
            "A carga chegou inteira, a viagem levou umas duas horas e não teve nenhum problema.",
            "Carga inteira, viagem de duas horas, sem nenhum problema.",
        ], self.tem_evento("relatorio", marco), 35)
        self.etapa("check-in por voz", True)
        self.tela("05-fila-estadia")

        self.falar_ate("descarga", [
            "Pronto, terminei a descarga. Já liberaram o caminhão.",
            "Descarga concluída, caminhão liberado.",
        ], lambda: self.status_rota() == "descarregada")
        descarga = next(e for e in reversed(self.eventos()) if e["tipo"] == "descarga")
        self.etapa("descarga por voz → rota descarregada", True, descarga["mensagem"][:80])
        # Encerra a conversa pelo backend: o agente sai da sala e o app precisa fechar a sessão
        # (a esfera para de animar, o que também deixa o uiautomator ler a tela).
        sessao = next(x for x in self.http("GET", "/sessions")
                      if x["rota_id"] == a.rota and x["papel"] == "motorista" and x["status"] == "ativa")
        self.http("DELETE", f"/sessions/{sessao['id']}", None, motorista)
        self.esperar("app fechar a sessão de voz", lambda: "disconnect from room" in self.adb(
            "logcat", "-d", "-s", "ReactNativeJS:V", check=False), 20)
        self.etapa("saída do agente encerra a conversa no app", True, f"sessão {sessao['id']}")
        self.quedas_esperadas = 1
        tempo = ((descarga.get("dados") or {}).get("estadia") or {}).get("tempo_parado", "")
        na_tela = self.esperar("tempo parado final na tela", lambda: any(
            tempo and tempo in t for t, _ in self.nos()), 20, 2)
        self.etapa("app mostra a estadia final do backend", bool(na_tela), tempo)
        self.tela("06-descarga")

        # ---------- verificações da corrida inteira ----------
        eventos = self.eventos()
        falsos = [e["mensagem"] for e in eventos if e["tipo"] == "alerta_motorista"
                  and (e.get("dados") or {}).get("prioridade") == "critico"]
        self.etapa("nenhum alerta crítico falso (falas sem problema)", not falsos, "; ".join(falsos)[:120])
        quedas = self.adb("logcat", "-d", "-s", "ReactNativeJS:V", check=False).count("disconnect from room")
        quedas -= self.quedas_esperadas  # o encerramento pedido acima não conta como queda
        self.etapa("voz não caiu durante a viagem (falas proativas)", quedas == 0, f"{quedas} quedas")
        pstn = [e for e in eventos if e["tipo"] == "decisao_agente" and "PSTN" in e["mensagem"]]
        self.etapa("sem ligação real (CCO assumiu a tempo)", not pstn)
        self.etapa("estadia calculada pelo backend", "estadia" in descarga["mensagem"].lower())

    def relatorio(self, erro: str | None) -> Path:
        dur = time.time() - self.inicio
        passou = erro is None
        linhas = [
            f"# E2E no celular: {'PASSOU' if passou else 'FALHOU'}",
            "",
            f"- Data: {datetime.now():%Y-%m-%d %H:%M} · duração {dur:.0f} s",
            f"- Rota {self.a.rota} · motorista {self.a.email} · API {self.a.api}",
            f"- Commits: mobile `{self.sh('git', '-C', str(RAIZ), 'rev-parse', '--short', 'HEAD', check=False).strip()}`"
            f" · backend `{self.sh('git', '-C', self.a.backend, 'rev-parse', '--short', 'HEAD', check=False).strip()}`",
            "",
            "| Etapa | Resultado | Detalhe |",
            "|---|---|---|",
            *[f"| {n} | {'ok' if ok else '**falhou**'} | {d} |" for n, ok, d in self.etapas],
        ]
        if erro:
            linhas += ["", f"**Erro:** {erro}"]
        linhas += ["", "Capturas: " + " · ".join(f"[{p.stem}]({p.name})" for p in sorted(self.saida.glob('*.png')))]
        caminho = self.saida / "relatorio.md"
        caminho.write_text("\n".join(linhas) + "\n", encoding="utf-8")
        (self.saida / "fala.wav").unlink(missing_ok=True)
        return caminho


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--metro", default="http://localhost:8081")
    ap.add_argument("--rota", type=int, default=2)
    ap.add_argument("--email", default="marina@rotasul.test")
    ap.add_argument("--backend", default=str(RAIZ.parent / "rodar-backend"), help="pasta do rodar-backend")
    ap.add_argument("--container-voz", default="rodar-backend-voice-agent-1")
    ap.add_argument("--sink", default="", help="id do alto-falante no PipeWire (wpctl status); vazio = padrão")
    ap.add_argument("--serial", default="", help="serial do celular (adb devices), se houver mais de um")
    e2e = E2E(ap.parse_args())
    erro = None
    try:
        e2e.rodar()
    except (Falhou, OSError, subprocess.TimeoutExpired) as ex:
        erro = str(ex)
    caminho = e2e.relatorio(erro)
    print(f"\n{'PASSOU' if erro is None else 'FALHOU: ' + erro} · relatório: {caminho.relative_to(RAIZ)}")
    return 0 if erro is None else 1


if __name__ == "__main__":
    sys.exit(main())
