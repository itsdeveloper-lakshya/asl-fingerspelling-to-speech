from googletrans import Translator
from gtts import gTTS
import pygame
import os
import time

# Supported languages
LANGUAGES = {
    # Indian Languages
    "hindi": "hi",
    "tamil": "ta",
    "telugu": "te", 
    "bengali": "bn",
    "marathi": "mr",
    "gujarati": "gu",
    "kannada": "kn",
    "malayalam": "ml",
    "punjabi": "pa",
    "urdu": "ur",

    # International Languages
    "english": "en",
    "french": "fr",
    "spanish": "es",
    "german": "de",
    "japanese": "ja",
    "chinese": "zh-cn"
}

DEFAULT_LANG = "hi"

translator = Translator()


def translate_and_speak(text, lang_code):
    translated = text
    try:
        res = translator.translate(text, dest=lang_code)
        if res and hasattr(res, 'text') and res.text:
            translated = res.text

        try:
            print("\n==============================")
            print("Original   :", text)
            print("Translated :", translated)
            print("Lang Code  :", lang_code)
            print("==============================")
        except UnicodeEncodeError:
            print("\n==============================")
            print("Original   :", text)
            print("Translated :", translated.encode('utf-8', errors='replace'))
            print("Lang Code  :", lang_code)
            print("==============================")
    except Exception as trans_err:
        print("Translation error:", trans_err)
        return text

    try:
        tts = gTTS(text=translated, lang=lang_code)
        tts.save("voice.mp3")

        pygame.mixer.init()
        pygame.mixer.music.load("voice.mp3")
        pygame.mixer.music.play()

        while pygame.mixer.music.get_busy():
            time.sleep(0.1)

        pygame.mixer.quit()
        if os.path.exists("voice.mp3"):
            os.remove("voice.mp3")

    except Exception as audio_err:
        print("Audio playback skipped (handled via browser):", audio_err)

    return translated


def select_language():
    print("\nAvailable Languages:\n")

    for lang in LANGUAGES:
        print(f"- {lang}")

    user_lang = input("\nEnter language: ").lower().strip()

    if user_lang in LANGUAGES:
        return LANGUAGES[user_lang]
    else:
        print("Invalid choice, defaulting to Hindi")
        return DEFAULT_LANG


if __name__ == "__main__":

    if not os.path.exists("output.txt"):
        print("output.txt not found!")
        exit()

    with open("output.txt", "r") as f:
        sentences = f.readlines()

    if len(sentences) == 0:
        print("No sentences found!")
        exit()

    print("\nStarting Translator...\n")

    selected_lang = select_language()

    for line in sentences:
        sentence = line.strip()

        if sentence:
            translate_and_speak(sentence, selected_lang)

    print("\nAll sentences processed!")

    # Clear file after processing
    open("output.txt", "w").close()