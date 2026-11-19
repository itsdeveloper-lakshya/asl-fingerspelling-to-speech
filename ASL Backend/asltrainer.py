import os
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "data.pickle")
MODEL_FILE = os.path.join(SCRIPT_DIR, "model.p")

if not os.path.exists(DATA_FILE):
    print(f"ERROR: {DATA_FILE} not found. Please run asldataset.py first!")
    exit(1)

with open(DATA_FILE, 'rb') as f:
    data_dict = pickle.load(f)

data = np.asarray(data_dict['data'])
labels = np.asarray(data_dict['labels'])

print(f"Loaded {len(data)} total samples across {len(np.unique(labels))} classes.")
print(f"Feature vector length: {len(data[0])} (expected 42)")

# Stratified train-test split
x_train, x_test, y_train, y_test = train_test_split(
    data, labels, test_size=0.2, shuffle=True, stratify=labels, random_state=42
)

print("Training Random Forest Classifier (300 trees, max depth 25)...")
model = RandomForestClassifier(n_estimators=300, max_depth=25, min_samples_split=2, random_state=42, n_jobs=-1)
model.fit(x_train, y_train)

# Evaluation
y_predict = model.predict(x_test)
score = accuracy_score(y_test, y_predict)

print(f"\n=========================================")
print(f"Overall Test Accuracy: {score * 100:.2f}%")
print(f"=========================================\n")
print("Detailed Classification Report:\n")
print(classification_report(y_test, y_predict))

# Serialize trained model
with open(MODEL_FILE, 'wb') as f:
    pickle.dump({'model': model}, f)

print(f"Model saved to: {MODEL_FILE}")