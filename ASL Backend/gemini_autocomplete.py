import os
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import google.generativeai as genai

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY", "")

if API_KEY:
    genai.configure(api_key=API_KEY)

model = None

def get_model():
    global model
    if model is None and API_KEY:
        model = genai.GenerativeModel("gemini-2.0-flash")
    return model


def get_word_suggestions(partial_text):
    """
    Given a partial word or letter sequence from ASL spelling,
    returns up to 3 likely word completions using Gemini.
    """
    if not partial_text or len(partial_text) < 2:
        return []

    m = get_model()
    if m is None:
        return fallback_suggestions(partial_text)

    prompt = (
        f'The user is spelling a word using ASL (American Sign Language) one letter at a time. '
        f'They have spelled: "{partial_text}". '
        f'Suggest the 3 most likely English words they are trying to spell. '
        f'Return ONLY a JSON array of 3 uppercase words, nothing else. '
        f'Example: ["HELLO", "HELP", "HELMET"]'
    )

    try:
        response = m.generate_content(prompt)
        text = response.text.strip()

        import json
        import re

        # If wrapped in markdown code fence, extract JSON array
        match = re.search(r'\[[\s\S]*?\]', text)
        if match:
            suggestions = json.loads(match.group(0))
            result = []
            for s in suggestions[:3]:
                if isinstance(s, str) and len(s.strip()) > 0:
                    result.append(s.strip().upper())
            if result:
                return result
    except Exception as e:
        print(f"Gemini autocomplete error: {e}")

    return fallback_suggestions(partial_text)


# Offline fallback: simple dictionary-based prefix matching
COMMON_WORDS = [
    "HELLO", "HELP", "HAPPY", "HOME", "HOW", "HAVE",
    "THANK", "THANKS", "THE", "THAT", "THIS", "THEY", "THERE", "THEIR",
    "WHAT", "WHERE", "WHEN", "WHO", "WHY", "WILL", "WITH", "WANT", "WATER",
    "GOOD", "GREAT", "GO", "GET",
    "PLEASE", "PEOPLE",
    "LOVE", "LIKE", "LOOK",
    "YES", "YOU", "YOUR",
    "NO", "NAME", "NEED", "NICE", "NAMASTE",
    "ARE", "AND", "ALL", "ABOUT",
    "CAN", "COME",
    "DO", "DAY",
    "EAT", "EVERY",
    "FOOD", "FRIEND", "FAMILY", "FINE",
    "MORE", "MAKE", "MY",
    "SORRY", "SEE", "SCHOOL", "SIGN",
    "UNDERSTAND",
    "VERY",
]

def fallback_suggestions(partial):
    partial_upper = partial.upper()
    matches = [w for w in COMMON_WORDS if w.startswith(partial_upper) and w != partial_upper]
    return matches[:3]
