import pickle
import cv2
import mediapipe as mp
import numpy as np
import time
import os
from collections import deque

# Resolve files relative to this script so the desktop mode works from any directory.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "output.txt")

# Clear output file on every run
open(OUTPUT_FILE, "w", encoding="utf-8").close()

# Load model
model_path = os.path.join(SCRIPT_DIR, "model.p")
model_dict = pickle.load(open(model_path, "rb"))
model = model_dict['model']

# Labels
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

buffer = deque(maxlen=10)

sentence = ""
current_letter = ""
last_added_time = 0
last_hand_seen_time = time.time()
hand_was_present = False

LETTER_DELAY = 3
SPACE_DELAY = 3
SENTENCE_DELAY = 8

def append_recognized_item(text, item):
    if len(item) > 1:
        if text and not text.endswith(" "):
            text += " "
        return text + item + " "
    return text + item

#  FUNCTION: check if hands are far apart (for delete)
def hands_far_apart(hand1, hand2):
    x1, y1 = hand1.landmark[0].x, hand1.landmark[0].y
    x2, y2 = hand2.landmark[0].x, hand2.landmark[0].y

    distance = ((x1 - x2)**2 + (y1 - y2)**2) ** 0.5
    return distance > 0.3  # adjust if needed


while True:
    ret, frame = cap.read()
    if not ret:
        break

    H, W, _ = frame.shape
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = hands.process(frame_rgb)
    current_time = time.time()

    # ================= DELETE USING TWO HANDS =================
    if results.multi_hand_landmarks and len(results.multi_hand_landmarks) == 2:
        hand1 = results.multi_hand_landmarks[0]
        hand2 = results.multi_hand_landmarks[1]

        if hands_far_apart(hand1, hand2):
            if len(sentence) > 0:
                sentence = sentence[:-1]
                print("Deleted last letter")

                time.sleep(1)

            cv2.putText(frame, "DELETE", (20, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            cv2.imshow('frame', frame)
            cv2.waitKey(1)
            continue

        # Two hands close together are a valid visible-hand state, not "no hand".
        last_hand_seen_time = current_time
        hand_was_present = True
        buffer.clear()
        current_letter = ""
        cv2.putText(frame, "Tracking paused: two hands close", (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.imshow('frame', frame)
        cv2.waitKey(1)
        continue

    # ================= HAND DETECTED =================
    if results.multi_hand_landmarks and len(results.multi_hand_landmarks) == 1:
        last_hand_seen_time = current_time

        # If hand was missing, reset tracking state so no ghost letter is added
        if not hand_was_present:
            buffer.clear()
            current_letter = ""
            last_added_time = current_time
            hand_was_present = True

        hand_landmarks = results.multi_hand_landmarks[0]
        mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        x_, y_, data_aux = [], [], []

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

            probs = model.predict_proba([np.asarray(data_aux)])[0]
            pred_index = np.argmax(probs)

            predicted_character = labels_dict[int(pred_index)]
            confidence = probs[pred_index] * 100

            # Confidence filter
            if confidence > 60:
                buffer.append(predicted_character)

            if len(buffer) >= 5:
                stable_prediction = max(set(buffer), key=buffer.count)

                if stable_prediction != current_letter:
                    current_letter = stable_prediction
                    last_added_time = current_time

                elif current_time - last_added_time >= LETTER_DELAY:
                    sentence = append_recognized_item(sentence, stable_prediction)
                    print("Letter added:", stable_prediction)

                    current_letter = ""
                    last_added_time = current_time
                    buffer.clear()

                # Display prediction
                x1 = int(min(x_) * W) - 10
                y1 = int(min(y_) * H) - 10

                display_text = f"{stable_prediction}: {confidence:.1f}%"

                cv2.rectangle(frame, (x1, y1), (x1 + 250, y1 + 60), (0, 0, 0), -1)
                cv2.putText(frame, display_text, (x1 + 10, y1 + 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    # ================= NO HAND =================
    else:
        time_without_hand = current_time - last_hand_seen_time

        # Hand lost: reset state & clear buffer so post-space re-entry works cleanly
        hand_was_present = False
        buffer.clear()
        current_letter = ""

        # SPACE
        if time_without_hand >= SPACE_DELAY:
            if len(sentence) > 0 and not sentence.endswith(" "):
                sentence += " "
                print("Space added")

        # SAVE SENTENCE
        if time_without_hand >= SENTENCE_DELAY:
            if sentence.strip() != "":
                print("Final Sentence:", sentence)

                with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                    f.write(sentence.strip() + "\n")

                sentence = ""

    # ================= DISPLAY =================
    cv2.putText(frame, "Sentence: " + sentence, (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.imshow('frame', frame)

    # ================= EXIT =================
    if cv2.waitKey(1) & 0xFF == ord('q'):
        if sentence.strip() != "":
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                f.write(sentence.strip() + "\n")
            print("Saved on exit:", sentence)

        break

cap.release()
cv2.destroyAllWindows()

#  AUTO TRIGGER TRANSLATOR
if os.path.exists("output.txt"):
    print("Launching translator...")
    os.system("python translator_speaker.py")