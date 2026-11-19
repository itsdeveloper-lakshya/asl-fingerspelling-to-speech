import os
import pickle
import mediapipe as mp
import cv2

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
# static_image_mode=True is best for processing a fixed dataset of images
hands = mp_hands.Hands(static_image_mode=True, max_num_hands=2, min_detection_confidence=0.7)

# Your specific local path
DATA_DIR = r'C:\Users\gupta\Downloads\asl_dataset'

data = []
labels = []

# Loop through each subfolder ('a', 'b', ..., '0', '1', ...)
for dir_ in os.listdir(DATA_DIR):
    class_path = os.path.join(DATA_DIR, dir_)
    if not os.path.isdir(class_path):
        continue 

    print(f"Processing class: {dir_}")

    for img_path in os.listdir(class_path):
        img_full_path = os.path.join(class_path, img_path)
        img = cv2.imread(img_full_path)
        
        if img is None:
            print(f"Skipping unreadable image: {img_path}")
            continue

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)

        # 42 zeros as a placeholder for each hand (21 landmarks x 2 coordinates)
        left_hand_data = [0] * 42  
        right_hand_data = [0] * 42  

        if results.multi_hand_landmarks:
            # zip results to get both landmarks and handedness (Left/Right)
            for hand_landmarks, hand_handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                hand_data_aux = []
                x_coords = [lm.x for lm in hand_landmarks.landmark]
                y_coords = [lm.y for lm in hand_landmarks.landmark]

                min_x, min_y = min(x_coords), min(y_coords)

                # Normalize landmarks relative to the bounding box of the hand
                for i in range(len(hand_landmarks.landmark)):
                    hand_data_aux.append(hand_landmarks.landmark[i].x - min_x)
                    hand_data_aux.append(hand_landmarks.landmark[i].y - min_y)

                # Assign data to the correct hand slot based on label
                if hand_handedness.classification[0].label == "Left":
                    left_hand_data = hand_data_aux
                else:
                    right_hand_data = hand_data_aux

        # Combine into the fixed 84-feature vector used by your trainer
        data.append(left_hand_data + right_hand_data)
        labels.append(dir_) # Saves 'a', 'b', '0', etc.

# Save the finalized dataset
output_file = 'ASLdata.pickle'
with open(output_file, 'wb') as f:
    pickle.dump({'data': data, 'labels': labels}, f)

print(f"Success! {output_file} created with {len(data)} samples.")