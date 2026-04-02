"""
agent_logic.py
Demo mode replies — Python port of getDemoReply() from aiAgent.js.
Used when no API key is configured and no offline LLM is running.
"""


def get_demo_reply(user_msg: str) -> str:
    """
    Return a canned demo reply based on simple keyword matching.
    Mirrors the original JS getDemoReply() exactly.
    """
    lower = user_msg.lower()

    if any(k in lower for k in ["quiz", "test me", "give me questions"]):
        return (
            "Here's a sample question:\n"
            "Q1. What does HTML stand for?\n"
            "A) HyperText Markup Language\n"
            "B) High Transfer Mode Link\n"
            "C) HyperText Medium Language\n"
            "D) None of these\n"
            "Answer: A\n\n"
            "(Connect a Gemini API key for real AI-generated quizzes!)"
        )

    if any(k in lower for k in ["study plan", "learning plan", "roadmap"]):
        return (
            "Here's a quick plan:\n"
            "**Week 1:** Basics & fundamentals\n"
            "**Week 2:** Core concepts with projects\n"
            "**Week 3:** Advanced topics\n"
            "**Week 4:** Build something real!\n\n"
            "(Connect a Gemini API key for a full personalised plan!)"
        )

    if any(k in lower for k in ["hello", "hi", "hey"]):
        return (
            "Hello! I'm ARIA, your AI avatar assistant. "
            "I'm running in demo mode right now. "
            "Add your Gemini API key in settings to unlock full AI! 🚀"
        )

    if any(k in lower for k in ["your name", "who are you"]):
        return (
            "I'm ARIA — Adaptive Responsive Intelligent Agent. "
            "I can help you learn, plan, answer questions, and more. "
            "Get your free Gemini API key at aistudio.google.com!"
        )

    preview = user_msg[:60] + ("…" if len(user_msg) > 60 else "")
    return (
        f'I\'m ARIA in demo mode. I heard: "{preview}". '
        "Connect a Gemini API key for real AI responses! 🤖"
    )
