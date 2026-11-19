# ASL Fingerspelling to Speech

An American Sign Language (ASL) recognition prototype that detects hand landmarks in a webcam feed, classifies individual letters and common phrases, and translates spoken text.

## Features

- Real-time ASL recognition with MediaPipe Hands
- Random Forest classification for A-Z and 32 trained classes
- Web interface with Flask REST API
- Desktop OpenCV interface
- Multilingual translation and text-to-speech
- Phrase-aware sentence building

## Requirements

- Python 3.10 or newer
- A webcam
- Windows, macOS, or Linux

Install Python dependencies:

```bash
python -m pip install -r requirements.txt
```

## Running the Web Application

From the repository root:

```bash
cd "ASL Backend"
python app.py
```

In a second terminal:

```bash
cd "ASL Frontend"
python -m http.server 8000
```

Open `http://localhost:8000/detector.html`.

On Windows, `Start_ASL_Project.bat` can launch both services.

Set `GEMINI_API_KEY` to enable Gemini word suggestions. The application provides an offline suggestion fallback when no key is configured.

## Reproducing Training

The repository includes the trained `model.p` and extracted `data.pickle` files, but it does **not** include the original training images. To retrain:

1. Obtain or collect ASL images separately.
2. Organize them into folders named with class names such as `A`, `B`, `Hello`, `Thank you`, or numeric class IDs.
3. Run:

```bash
cd "ASL Backend"
python asldataset.py --data-dir "path/to/dataset"
python asltrainer.py
```

The dataset location can also be supplied with `ASL_DATA_DIR`.

## Known Limitations

- J and Z are dynamic ASL signs, but the current model was trained on still poses. Motion and temporal sequence recognition are not implemented, so live J and Z recognition may be unreliable.
- Detection supports a single active hand for landmark classification. Two hands close together pause tracking rather than being classified.
- The included dataset and model accuracy depend on camera, lighting, hand size, and sign variation.
- Some translations and speech features require network access or platform speech support.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
