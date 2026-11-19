import os
import pickle
import mediapipe as mp
import cv2
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "data.pickle")

parser = argparse.ArgumentParser(description="Extract normalized hand landmarks from ASL training images.")
parser.add_argument(
    "--data-dir",
    default=os.environ.get("ASL_DATA_DIR", os.path.join(SCRIPT_DIR, "data")),
    help="Dataset directory containing one folder per ASL class (default: ASL Backend/data or ASL_DATA_DIR)",
)
args = parser.parse_args()
DATA_DIR = os.path.abspath(args.data_dir)

# 32-class ASL label map
labels_dict = {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H',
    8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O',
    15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U', 21: 'V',
    22: 'W', 23: 'X', 24: 'Y', 25: 'Z',
    26: 'I Love U', 27: 'Hello', 28: 'Yes',
    29: 'No', 30: 'Namaste', 31: 'Thank you'
}

# Reverse map: supports folder names like 'A', 'hello', '0', etc.
name_to_label = {v.lower().strip(): k for k, v in labels_dict.items()}

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.3)

data = []
labels = []

if not os.path.exists(DATA_DIR):
    print(f"ERROR: Dataset directory not found at: {DATA_DIR}")
    print("Please verify your folder location and try again.")
    exit(1)

subdirs = [d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d))]
print(f"Found {len(subdirs)} class folders in {DATA_DIR}")

def sort_key(s):
    return int(s) if s.isdigit() else s.lower()

subdirs.sort(key=sort_key)

total_images = 0
successful_samples = 0

for dir_ in subdirs:
    dir_path = os.path.join(DATA_DIR, dir_)

    # Resolve label integer from folder name
    if dir_.isdigit():
        label_id = int(dir_)
    else:
        label_id = name_to_label.get(dir_.lower().strip(), None)

    if label_id is None or label_id not in labels_dict:
        print(f"Skipping unrecognized folder '{dir_}'")
        continue

    char_name = labels_dict[label_id]
    image_files = [f for f in os.listdir(dir_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Processing [{label_id} - '{char_name}']: {len(image_files)} images...")

    folder_success = 0

    for img_name in image_files:
        total_images += 1
        img_path = os.path.join(dir_path, img_name)
        img = cv2.imread(img_path)
        if img is None:
            continue

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)

        # Accept only single-hand detections for clean training samples
        if results.multi_hand_landmarks and len(results.multi_hand_landmarks) == 1:
            hand_landmarks = results.multi_hand_landmarks[0]

            x_ = [lm.x for lm in hand_landmarks.landmark]
            y_ = [lm.y for lm in hand_landmarks.landmark]

            min_x, max_x = min(x_), max(x_)
            min_y, max_y = min(y_), max(y_)
            width = (max_x - min_x) if (max_x - min_x) > 0 else 1e-6
            height = (max_y - min_y) if (max_y - min_y) > 0 else 1e-6

            # Scale-normalized features for distance-invariant recognition
            data_aux = []
            for lm in hand_landmarks.landmark:
                data_aux.append((lm.x - min_x) / width)
                data_aux.append((lm.y - min_y) / height)

            if len(data_aux) == 42:
                data.append(data_aux)
                labels.append(label_id)
                folder_success += 1
                successful_samples += 1

    print(f"   Extracted {folder_success}/{len(image_files)} landmark samples for '{char_name}'")

print("\n" + "="*50)
print(f"Dataset Creation Completed!")
print(f"Total Images Processed : {total_images}")
print(f"Successful Hand Samples: {successful_samples}")
print(f"Saving to: {OUTPUT_FILE}...")

with open(OUTPUT_FILE, 'wb') as f:
    pickle.dump({'data': data, 'labels': labels}, f)

print("data.pickle created successfully. You can now run asltrainer.py")