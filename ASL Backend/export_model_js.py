import os
import pickle
import m2cgen as m2c

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(SCRIPT_DIR, "model.p")
FRONTEND_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "ASL Frontend")
OUTPUT_JS = os.path.join(FRONTEND_DIR, "model.js")

if not os.path.exists(MODEL_FILE):
    print(f"ERROR: {MODEL_FILE} not found.")
    exit(1)

with open(MODEL_FILE, 'rb') as f:
    model_dict = pickle.load(f)

model = model_dict['model']

print("Converting Random Forest to JavaScript...")
js_code = m2c.export_to_javascript(model, function_name="score")

# Wrap in a helper that returns the predicted class index and confidence
wrapper = """
// Auto-generated from model.p via m2cgen
// Input: array of 42 scale-normalized landmark features
// Output of score(): array of class probabilities

function predictFromLandmarks(features) {
    var scores = score(features);
    var maxIdx = 0;
    var maxVal = scores[0];
    for (var i = 1; i < scores.length; i++) {
        if (scores[i] > maxVal) {
            maxVal = scores[i];
            maxIdx = i;
        }
    }
    // Convert raw scores to percentage confidence
    var sum = 0;
    for (var i = 0; i < scores.length; i++) { sum += scores[i]; }
    var confidence = (sum > 0) ? (maxVal / sum) * 100 : 0;
    return { classIndex: maxIdx, confidence: confidence };
}
"""

with open(OUTPUT_JS, 'w') as f:
    f.write(js_code)
    f.write("\n")
    f.write(wrapper)

file_size_kb = os.path.getsize(OUTPUT_JS) / 1024
print(f"Exported to: {OUTPUT_JS}")
print(f"File size: {file_size_kb:.0f} KB")
print("Done. Include model.js in detector.html before detector.js.")
