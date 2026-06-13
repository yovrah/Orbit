import os
import io
import base64
import pythoncom
import win32com.client
import win32gui
import win32ui
import win32con
from PIL import Image

def extract_icon_as_base64(exe_path: str) -> str:
    try:
        # Extract large icon handle
        large, small = win32gui.ExtractIconEx(exe_path, 0)
        if large:
            hicon = large[0]
            # Release unused handles
            for h in small:
                win32gui.DestroyIcon(h)
            for h in large[1:]:
                win32gui.DestroyIcon(h)

            hdc = win32gui.GetDC(0)
            dc = win32ui.CreateDCFromHandle(hdc)
            hdc_mem = dc.CreateCompatibleDC()
            
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(dc, 32, 32)
            hdc_mem.SelectObject(bmp)
            
            hdc_mem.DrawIcon((0, 0), hicon)
            bmp_info = bmp.GetInfo()
            bmp_str = bmp.GetBitmapBits(True)
            
            im = Image.frombuffer(
                'RGBA',
                (bmp_info['bmWidth'], bmp_info['bmHeight']),
                bmp_str, 'raw', 'BGRA', 0, 1
            )
            
            # GDI Cleanup
            win32gui.ReleaseDC(0, hdc)
            win32gui.DestroyIcon(hicon)
            
            buf = io.BytesIO()
            im.save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Failed to extract icon for {exe_path}: {e}")
    return ""

def scan_start_menu():
    # Initialize COM context for the calling thread
    pythoncom.CoInitialize()
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        programs = []
        
        paths = [
            os.path.join(os.environ.get('PROGRAMDATA', 'C:\\ProgramData'), 'Microsoft\\Windows\\Start Menu\\Programs'),
            os.path.join(os.environ.get('APPDATA', ''), 'Microsoft\\Windows\\Start Menu\\Programs')
        ]
        
        for base_path in paths:
            if not os.path.exists(base_path):
                continue
            for root, dirs, files in os.walk(base_path):
                for file in files:
                    if file.endswith('.lnk'):
                        lnk_path = os.path.join(root, file)
                        try:
                            shortcut = shell.CreateShortcut(lnk_path)
                            target = shortcut.TargetPath
                            if target and target.endswith('.exe') and os.path.exists(target):
                                programs.append({
                                    "name": file[:-4],
                                    "path": target,
                                    "icon": extract_icon_as_base64(target)
                                })
                        except Exception:
                            continue
        return programs
    finally:
        pythoncom.CoUninitialize()
