import pickle
import cv2
import mediapipe as mp
import numpy as np
from collections import deque
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(SCRIPT_DIR, "model.p")

# Load trained model
model_dict = pickle.load(open(MODEL_FILE, "rb"))
model = model_dict['model']

labels_dict = {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H',
    8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O',
    15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U', 21: 'V',
    22: 'W', 23: 'X', 24: 'Y', 25: 'Z',
    26: 'I Love U', 27: 'Hello', 28: 'Yes',
    29: 'No', 30: 'Namaste', 31: 'Thank you'
}

cap = cv2.VideoCapture(0)

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, min_detection_confidence=0.5)

mp_drawing = mp.solutions.drawing_utils

# Prediction smoothing buffer
buffer = deque(maxlen=10)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    H, W, _ = frame.shape
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = hands.process(frame_rgb)

    if results.multi_hand_landmarks and len(results.multi_hand_landmarks) == 1:
        hand_landmarks = results.multi_hand_landmarks[0]

        mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        x_ = []
        y_ = []
        data_aux = []

        for lm in hand_landmarks.landmark:
            x_.append(lm.x)
            y_.append(lm.y)

        min_x, max_x = min(x_), max(x_)
        min_y, max_y = min(y_), max(y_)
        width = (max_x - min_x) if (max_x - min_x) > 0 else 1e-6
        height = (max_y - min_y) if (max_y - min_y) > 0 else 1e-6

        for lm in hand_landmarks.landmark:
            data_aux.append((lm.x - min_x) / width)
            data_aux.append((lm.y - min_y) / height)

        if len(data_aux) == 42:
            prediction = model.predict([np.asarray(data_aux)])
            predicted_character = labels_dict[int(prediction[0])]

            # Majority vote smoothing
            buffer.append(predicted_character)
            final_prediction = max(set(buffer), key=buffer.count)

            x1 = int(min(x_) * W) - 10
            y1 = int(min(y_) * H) - 10

            cv2.rectangle(frame, (x1, y1), (x1 + 150, y1 + 50), (0, 0, 0), -1)
            cv2.putText(frame, final_prediction, (x1 + 5, y1 + 35),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    cv2.imshow('frame', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()