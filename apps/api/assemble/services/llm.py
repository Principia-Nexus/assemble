"""Claude calls through the Anthropic SDK. Credentials come from ANTHROPIC_API_KEY (or an `ant auth login` profile)."""
import os

import anthropic

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
_client = None


def client():
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


def image(b64, media_type="image/jpeg"):
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}


class Chat:
    """One system prompt and the turns sent so far; send() appends both sides so a follow-up sees the first answer."""

    def __init__(self, system):
        self.system, self.messages = system, []

    async def send(self, text, images=()):
        self.messages.append({"role": "user", "content": [*images, {"type": "text", "text": text}]})
        async with client().beta.messages.stream(model=MODEL, max_tokens=64000, system=self.system, messages=self.messages,
                                                 betas=["server-side-fallback-2026-07-01"], fallbacks="default") as stream:
            msg = await stream.get_final_message()
        self.messages.append({"role": "assistant", "content": msg.content})
        if msg.stop_reason == "refusal":
            return ""
        return "".join(b.text for b in msg.content if b.type == "text")
