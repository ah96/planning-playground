# Third-party software and assets

The code of this repository is under the BSD 3-Clause licence (see `LICENSE`). It uses the software and the fonts below. None of them is redistributed here.

| Software or asset | Licence | How it is used | Where it comes from |
|---|---|---|---|
| **Flask** | BSD-3-Clause | imported by `app.py` to serve the page and the planner. The standalone file does not need it. | `pip`, listed in `requirements.txt` |
| **pytest** | MIT | runs the tests in `test/` | `pip` |
| **Chrome** or **Chromium** | each states its own | called as a separate process by `test/test_parity.py`, to run the JavaScript planner | installed separately |
| **Nunito** (font) | SIL Open Font License 1.1 | named in `static/css/style.css` as the text font. The browser loads it. | Google Fonts |
| **JetBrains Mono** (font) | SIL Open Font License 1.1 | named in `static/css/style.css` as the font for numbers, facts and plans. The browser loads it. | Google Fonts |

The licences in this file were read on 2026-11-25: for Flask and pytest from their records at PyPI (`https://pypi.org/pypi/Flask/json`, `https://pypi.org/pypi/pytest/json`), and for the two fonts from the file `OFL.txt` in the folders `ofl/nunito` and `ofl/jetbrainsmono` of the repository [google/fonts](https://github.com/google/fonts).
