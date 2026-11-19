from flask import Flask, jsonify, request
import threading
import subprocess
import os
import sys
import pickle
import numpy as np

app = Flask(__name__)

# CORS middleware
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Load model and label map
backend_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(backend_dir, "model.p")
model = None

labels_dict = {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H',
    8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O',
    15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U', 21: 'V',
    22: 'W', 23: 'X', 24: 'Y', 25: 'Z',
    26: 'I Love U', 27: 'Hello', 28: 'Yes',
    29: 'No', 30: 'Namaste', 31: 'Thank you'
}

if os.path.exists(model_path):
    try:
        with open(model_path, 'rb') as f:
            model_dict = pickle.load(f)
            model = model_dict.get('model')
            print("Model loaded successfully.")
    except Exception as e:
        print("Error loading model.p in Flask:", e)


from translator_speaker import translate_and_speak, LANGUAGES

sentence = ""
running = False
process = None


@app.route('/predict', methods=['POST'])
def predict():
    global model
    if model is None:
        return jsonify({"error": "Model not loaded", "letter": "", "confidence": 0}), 500

    data = request.json or {}
    landmarks = data.get("landmarks", [])

    if len(landmarks) != 42:
        return jsonify({"error": f"Expected 42 features, got {len(landmarks)}", "letter": "", "confidence": 0}), 400

    try:
        data_aux = np.asarray([landmarks], dtype=np.float32)
        probs = model.predict_proba(data_aux)[0]
        pred_index = int(np.argmax(probs))
        if hasattr(model, 'classes_'):
            actual_class = int(model.classes_[pred_index])
        else:
            actual_class = pred_index
        predicted_character = labels_dict.get(actual_class, "")
        confidence = float(probs[pred_index] * 100)

        return jsonify({
            "letter": predicted_character,
            "confidence": round(confidence, 1)
        })
    except Exception as e:
        return jsonify({"error": str(e), "letter": "", "confidence": 0}), 500


@app.route('/languages', methods=['GET'])
def get_languages():

    regional_codes = {"hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur"}
    regional = []
    international = []

    for name, code in LANGUAGES.items():
        item = {"name": name.capitalize(), "code": code}
        if code in regional_codes:
            regional.append(item)
        else:
            international.append(item)

    return jsonify({
        "regional": regional,
        "international": international,
        "all": LANGUAGES
    })


@app.route('/start')
def start():
    global running
    running = True
    return jsonify({"status": "started", "mode": "web"})


@app.route('/stop')
def stop():
    global running, process
    running = False
    if process is not None:
        process.terminate()
        process = None
    return jsonify({"status": "stopped"})


@app.route('/get_text')
def get_text():
    global sentence
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.txt")
    latest_sentence = ""
    all_sentences = []
    
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f.readlines() if line.strip()]
                all_sentences = lines
                latest_sentence = lines[-1] if lines else ""
        except Exception as e:
            print("Error reading output.txt:", e)
            
    return jsonify({
        "sentence": latest_sentence,
        "history": all_sentences,
        "status": "running" if running else "idle"
    })


@app.route('/translate', methods=['POST'])
def translate():
    data = request.json or {}
    text = data.get("text", "")
    lang = data.get("lang", "hi")

    if not text:
        return jsonify({"translated": "", "error": "No text provided"})


    translated = translate_and_speak(text, lang)
    return jsonify({"translated": translated})


# LLM-powered word autocomplete
from gemini_autocomplete import get_word_suggestions

@app.route('/autocomplete', methods=['POST'])
def autocomplete():
    data = request.json or {}
    partial = data.get("partial", "")

    if len(partial) < 2:
        return jsonify({"suggestions": []})

    suggestions = get_word_suggestions(partial)
    return jsonify({"suggestions": suggestions})


if __name__ == "__main__":
    print("Starting ASL Flask Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)