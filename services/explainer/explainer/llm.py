"""Client for an OpenAI-compatible chat endpoint: local Ollama in the prototype, Azure OpenAI later.

Configured by environment only. Off unless AMANA_LLM_URL is set.
  AMANA_LLM_URL    e.g. http://localhost:11434/v1 (Ollama) or an Azure OpenAI deployment URL
  AMANA_LLM_MODEL  e.g. llama3.1:8b
  AMANA_LLM_KEY    optional API key
  AMANA_LLM_AUTH   "bearer" (default) or "azure" (sends the key as api-key)
What is sent: reviewed card text, the person's question, and for a counsellor draft the case tier,
the result type and (only if the person shared it) the condition card. Never a name, id, key or token.
In the prototype the model runs on the same machine (Ollama), so nothing leaves it.
"""
import json
import os
from dataclasses import dataclass

import httpx

# What a model call can raise: network/HTTP failure, bad JSON, or a reply of the wrong shape.
LLM_ERRORS = (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError, AttributeError)


@dataclass
class LLM:
    url: str
    model: str
    key: str = ""
    auth: str = "bearer"
    timeout: float = 60.0

    @classmethod
    def from_env(cls) -> "LLM | None":
        url = os.environ.get("AMANA_LLM_URL", "").rstrip("/")
        if not url:
            return None
        return cls(url, os.environ.get("AMANA_LLM_MODEL", "llama3.1:8b"),
                   os.environ.get("AMANA_LLM_KEY", ""), os.environ.get("AMANA_LLM_AUTH", "bearer"))

    @property
    def name(self) -> str:
        return self.model

    def chat(self, system: str, user: str, as_json: bool = False) -> str:
        headers = {}
        if self.key:
            headers = {"api-key": self.key} if self.auth == "azure" else {"Authorization": f"Bearer {self.key}"}
        body = {"model": self.model, "temperature": 0, "messages": [
            {"role": "system", "content": system}, {"role": "user", "content": user}]}
        if as_json:
            body["response_format"] = {"type": "json_object"}
        r = httpx.post(f"{self.url}/chat/completions", json=body, headers=headers, timeout=self.timeout)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()

    def chat_json(self, system: str, user: str) -> dict:
        text = self.chat(system, user, as_json=True)
        try:
            out = json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}")
            out = json.loads(text[start:end + 1]) if start >= 0 < end else {}
        return out if isinstance(out, dict) else {}
