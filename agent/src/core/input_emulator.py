from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key

mouse = MouseController()
keyboard = KeyboardController()

# Map modifier names to pynput Key enums
MODIFIER_MAP = {
    "ctrl": Key.ctrl,
    "alt": Key.alt,
    "shift": Key.shift,
    "win": Key.cmd
}

# Map special key string labels to pynput Key enums
SPECIAL_KEYS_MAP = {
    "backspace": Key.backspace,
    "enter": Key.enter,
    "tab": Key.tab,
    "esc": Key.esc,
    "space": Key.space,
    "up": Key.up,
    "down": Key.down,
    "left": Key.left,
    "right": Key.right,
    "delete": Key.delete,
    "home": Key.home,
    "end": Key.end,
    "pageup": Key.page_up,
    "pagedown": Key.page_down
}

def move_mouse(dx: float, dy: float, accel: bool = True):
    scale = 1.0
    if accel:
        # Simple dynamic acceleration scaling
        speed = (dx**2 + dy**2) ** 0.5
        if speed > 15:
            scale = 2.2
        elif speed > 5:
            scale = 1.6
        else:
            scale = 1.0

    # Move cursor relatively
    mouse.move(int(dx * scale), int(dy * scale))

def click_mouse(button: str, click_type: str = "click"):
    btn = Button.left
    if button == "right":
        btn = Button.right
    elif button == "middle":
        btn = Button.middle

    if click_type == "click":
        mouse.click(btn, 1)
    elif click_type == "double":
        mouse.click(btn, 2)
    elif click_type == "down":
        mouse.press(btn)
    elif click_type == "up":
        mouse.release(btn)

def scroll_mouse(dx: float, dy: float):
    # Windows native scroll direction: negative vertical delta scrolls down
    mouse.scroll(int(dx), int(dy))

def handle_keyboard(key: str, key_type: str = "keydown", modifiers: dict = None):
    active_modifiers = []
    if modifiers:
        for mod_name, is_active in modifiers.items():
            if is_active and mod_name in MODIFIER_MAP:
                active_modifiers.append(MODIFIER_MAP[mod_name])

    # Press active modifier keys
    for mod_key in active_modifiers:
        keyboard.press(mod_key)

    # Determine key target
    target_key = None
    key_lower = key.lower()
    if key_lower in SPECIAL_KEYS_MAP:
        target_key = SPECIAL_KEYS_MAP[key_lower]
    elif len(key) == 1:
        target_key = key
    
    # Emulate key stroke
    if target_key:
        try:
            if key_type == "keydown":
                keyboard.press(target_key)
            elif key_type == "keyup":
                keyboard.release(target_key)
            elif key_type == "press":
                keyboard.press(target_key)
                keyboard.release(target_key)
        except Exception as e:
            print(f"Emulate key failed for {key}: {e}")

    # Release modifier keys in reverse order
    for mod_key in reversed(active_modifiers):
        keyboard.release(mod_key)

def move_mouse_absolute(x_ratio: float, y_ratio: float):
    import ctypes
    user32 = ctypes.windll.user32
    user32.SetProcessDPIAware()
    width = user32.GetSystemMetrics(0)
    height = user32.GetSystemMetrics(1)
    
    target_x = int(x_ratio * width)
    target_y = int(y_ratio * height)
    
    # Clip to boundaries
    target_x = max(0, min(width - 1, target_x))
    target_y = max(0, min(height - 1, target_y))
    
    mouse.position = (target_x, target_y)

