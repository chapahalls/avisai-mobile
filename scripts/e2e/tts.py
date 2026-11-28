"""Sintetiza uma fala pt-BR em WAV com o TTS do LiveKit Inference.

Roda dentro do container `voice-agent` do rodar-backend, que já tem as credenciais do LiveKit.
Uso: python tts.py "texto" /tmp/saida.wav
"""
import asyncio
import sys
import wave

import aiohttp
from livekit.agents import inference

TAXA = 24000


async def sintetizar(texto: str, destino: str) -> None:
    async with aiohttp.ClientSession() as http:
        tts = inference.TTS("cartesia/sonic-2", language="pt", http_session=http, sample_rate=TAXA)
        quadros = [bytes(ev.frame.data) async for ev in tts.synthesize(texto)]
    with wave.open(destino, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(b"".join(quadros))


if __name__ == "__main__":
    asyncio.run(sintetizar(sys.argv[1], sys.argv[2]))
