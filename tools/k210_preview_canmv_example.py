"""
VisionWiz image sync example for CanMV / MicroPython.

Upload `visionwiz_image_sync.py` together with this example file.
Keep your original authentication logic in the main program, then let this
example continue reusing the same UARTHS port for image preview sync.
"""

from visionwiz_image_sync import VisionWizImageSync


bridge = VisionWizImageSync(show_lcd=True)
bridge.run_forever()
